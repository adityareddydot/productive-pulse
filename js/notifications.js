/**
 * Notifications Module - Handle browser notifications
 */

class NotificationManager {
    constructor() {
        this.permission = 'default';
    }

    async init() {
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return false;
        }

        this.permission = Notification.permission;
        return this.permission === 'granted';
    }

    async requestPermission() {
        if (!('Notification' in window)) {
            return false;
        }

        try {
            const result = await Notification.requestPermission();
            this.permission = result;
            return result === 'granted';
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }

    isGranted() {
        return this.permission === 'granted';
    }

    async show(title, options = {}) {
        if (!this.isGranted()) {
            console.warn('Notification permission not granted');
            return null;
        }

        const defaultOptions = {
            icon: 'assets/icon-192.png',
            badge: 'assets/icon-192.png',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            tag: 'productivity-pulse',
            renotify: true,
            ...options
        };

        try {
            // Try to use service worker notification first (more reliable)
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(title, defaultOptions);
                return true;
            } else {
                // Fallback to regular notification
                const notification = new Notification(title, defaultOptions);

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                    if (options.onClick) {
                        options.onClick();
                    }
                };

                return notification;
            }
        } catch (error) {
            console.error('Error showing notification:', error);
            return null;
        }
    }

    async showProductivityReminder() {
        const now = new Date();
        const hour = now.getHours();
        const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

        const messages = [
            `How's your ${period} going? 🎯`,
            'Time for a quick check-in! ⚡',
            'How productive was the last hour? 📊',
            'Quick productivity pulse check! 💪'
        ];

        const message = messages[Math.floor(Math.random() * messages.length)];

        return this.show('Productivity Pulse', {
            body: message,
            data: { type: 'reminder', timestamp: now.toISOString() },
            actions: [
                { action: 'log', title: '📝 Log Now' },
                { action: 'snooze', title: '⏰ Snooze' }
            ]
        });
    }

    async showMissedReminder() {
        return this.show('Don\'t forget to log!', {
            body: 'You missed the last check-in. Tap to log now.',
            data: { type: 'missed' },
            tag: 'productivity-pulse-missed'
        });
    }
}

// Global notification manager instance
const notifications = new NotificationManager();
