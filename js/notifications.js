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
            timestamp: Date.now(), // Helps with sorting
            ...options
        };

        try {
            // ALWAYS try to use Service Worker notification if available
            // This is required for Android background notifications
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                console.log('Using Service Worker for notification');
                await registration.showNotification(title, defaultOptions);
                return true;
            } else {
                // Fallback only for browsers without SW support
                console.log('Service Worker not found using legacy Notification API');
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
            // Last resort fallback
            try {
                return new Notification(title, defaultOptions);
            } catch (e) {
                return null;
            }
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
