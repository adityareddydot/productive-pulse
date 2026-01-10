/**
 * Scheduler Module - Handle reminder timing
 * Supports fractional hours (e.g., 0.0166 = 1 minute, 0.25 = 15 minutes)
 */

class Scheduler {
    constructor() {
        this.timerId = null;
        this.missedTimerId = null;
        this.lastNotificationTime = null;
        this.pendingLog = false;
    }

    async init() {
        // Restore state from storage
        const lastNotif = localStorage.getItem('lastNotificationTime');
        if (lastNotif) {
            this.lastNotificationTime = new Date(lastNotif);
        }

        const pending = localStorage.getItem('pendingLog');
        this.pendingLog = pending === 'true';
    }

    // Calculate next notification time based on interval (supports fractional hours)
    getNextNotificationTime(intervalHours) {
        const now = new Date();
        const intervalMs = intervalHours * 60 * 60 * 1000;

        // Round up to the next interval boundary
        const msIntoDay = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000;
        const nextSlotMs = Math.ceil(msIntoDay / intervalMs) * intervalMs;

        const nextTime = new Date(now);
        nextTime.setHours(0, 0, 0, 0);
        nextTime.setTime(nextTime.getTime() + nextSlotMs);

        // If next time is in the past or right now, add one interval
        if (nextTime <= now) {
            nextTime.setTime(nextTime.getTime() + intervalMs);
        }

        return nextTime;
    }

    // Check if current time is within quiet hours
    isQuietHours(quietStart, quietEnd) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const [startH, startM] = quietStart.split(':').map(Number);
        const [endH, endM] = quietEnd.split(':').map(Number);

        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        // Handle overnight quiet hours (e.g., 23:00 to 07:00)
        if (startMinutes > endMinutes) {
            return currentMinutes >= startMinutes || currentMinutes < endMinutes;
        } else {
            return currentMinutes >= startMinutes && currentMinutes < endMinutes;
        }
    }

    // Get the slot time range for display (supports fractional hours)
    getSlotTimeRange(slotHour, intervalHours) {
        const formatTime = (hours) => {
            const h = Math.floor(hours);
            const m = Math.round((hours - h) * 60);
            const period = h >= 12 ? 'PM' : 'AM';
            const hour12 = h % 12 || 12;
            if (m === 0) {
                return `${hour12}:00 ${period}`;
            }
            return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
        };

        const startHour = slotHour;
        const endHour = (slotHour + intervalHours) % 24;

        return {
            start: formatTime(startHour),
            end: formatTime(endHour),
            display: `${formatTime(startHour)} - ${formatTime(endHour)}`
        };
    }

    // Start the scheduler
    async start(settings, onNotification) {
        this.stop(); // Clear any existing timers

        const { reminderInterval, quietHoursStart, quietHoursEnd, trackingEnabled } = settings;

        if (!trackingEnabled) {
            console.log('Tracking disabled, scheduler not started');
            return;
        }

        const scheduleNext = async () => {
            // Calculate time until next notification
            const nextTime = this.getNextNotificationTime(reminderInterval);
            const delay = nextTime.getTime() - Date.now();

            console.log(`Next notification scheduled for: ${nextTime.toLocaleTimeString()} (in ${Math.round(delay / 1000)}s)`);

            this.timerId = setTimeout(async () => {
                // Check quiet hours
                if (this.isQuietHours(quietHoursStart, quietHoursEnd)) {
                    console.log('In quiet hours, skipping notification');
                    scheduleNext();
                    return;
                }

                // Send notification
                this.lastNotificationTime = new Date();
                localStorage.setItem('lastNotificationTime', this.lastNotificationTime.toISOString());

                this.pendingLog = true;
                localStorage.setItem('pendingLog', 'true');

                if (onNotification) {
                    await onNotification();
                }

                // Schedule missed reminder
                this.scheduleMissedReminder(settings.missedReminderMinutes, onNotification);

                // Schedule next notification
                scheduleNext();
            }, delay);
        };

        scheduleNext();

        // Check if there's a pending log from before
        if (this.pendingLog) {
            if (onNotification) {
                setTimeout(() => onNotification(true), 1000);
            }
        }
    }

    // Schedule a reminder if user misses the first notification
    scheduleMissedReminder(minutes, onNotification) {
        if (this.missedTimerId) {
            clearTimeout(this.missedTimerId);
        }

        this.missedTimerId = setTimeout(async () => {
            if (this.pendingLog) {
                console.log('Sending missed reminder');
                await notifications.showMissedReminder();
            }
        }, minutes * 60 * 1000);
    }

    // Mark log as complete
    logComplete() {
        this.pendingLog = false;
        localStorage.setItem('pendingLog', 'false');

        if (this.missedTimerId) {
            clearTimeout(this.missedTimerId);
            this.missedTimerId = null;
        }
    }

    // Stop the scheduler
    stop() {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        if (this.missedTimerId) {
            clearTimeout(this.missedTimerId);
            this.missedTimerId = null;
        }
    }

    // Get timeline slots for today (supports fractional hours)
    getTodaySlots(intervalHours) {
        const slots = [];
        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;

        // For very small intervals, limit the number of slots shown
        const maxSlots = 48; // Max 48 slots per day (30-min intervals)
        const effectiveInterval = Math.max(intervalHours, 24 / maxSlots);

        // Start from the first slot of the day (based on interval)
        for (let hour = 0; hour < 24; hour += effectiveInterval) {
            const slotTime = new Date(now);
            slotTime.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);

            const slotEndHour = hour + effectiveInterval;

            let status = 'past';
            const currentSlotStart = Math.floor(currentHour / effectiveInterval) * effectiveInterval;
            if (Math.abs(hour - currentSlotStart) < 0.001) {
                status = 'current';
            } else if (hour > currentHour) {
                status = 'future';
            }

            slots.push({
                hour: hour,
                endHour: slotEndHour % 24,
                time: slotTime,
                timeRange: this.getSlotTimeRange(hour, effectiveInterval),
                status
            });
        }

        return slots;
    }
}

// Global scheduler instance
const scheduler = new Scheduler();
