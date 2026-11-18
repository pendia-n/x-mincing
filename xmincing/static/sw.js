const cacheName = 'xmincing-offline-v1';

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(cacheName).then((cache) => cache.add('/offline.html')));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(caches.keys().then((keys) => Promise.all(keys
		.filter((key) => key.startsWith('xmincing-offline-') && key !== cacheName)
		.map((key) => caches.delete(key))).then(() => self.clients.claim())));
});

self.addEventListener('fetch', (event) => {
	if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
	event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});
