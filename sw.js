/**
 * Service Worker for Productivity Pulse PWA
 */

const CACHE_NAME = 'productivity-pulse-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/style.css',
    '/js/storage.js',
    '/js/notifications.js',
    '/js/scheduler.js',
    '/js/analytics.js',
    '/js/app.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached response if found
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then((response) => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone and cache the response
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                });
            }).catch(() => {
                // Return offline fallback if available
                return caches.match('/index.html');
            })
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);

    event.notification.close();

    // Focus or open the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if ('focus' in client) {
                        return client.focus();
                    }
                }

                // Otherwise open new window
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Handle notification actions
self.addEventListener('notificationclick', (event) => {
    const action = event.action;

    if (action === 'log') {
        // Open app to log screen
        event.waitUntil(
            clients.openWindow('/?action=log')
        );
    } else if (action === 'snooze') {
        // Schedule another notification in 15 minutes
        setTimeout(() => {
            self.registration.showNotification('Productivity Pulse', {
                body: 'Snoozed reminder - time to log!',
                icon: 'assets/icon-192.png',
                tag: 'productivity-pulse-snooze'
            });
        }, 15 * 60 * 1000);
    }
});

// Handle push events (for future server-side notifications)
self.addEventListener('push', (event) => {
    console.log('Push event received:', event);

    const options = {
        body: 'How\'s your productivity?',
        icon: 'assets/icon-192.png',
        badge: 'assets/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'productivity-pulse',
        requireInteraction: true,
        actions: [
            { action: 'log', title: '📝 Log Now' },
            { action: 'snooze', title: '⏰ Snooze' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Productivity Pulse', options)
    );
});
