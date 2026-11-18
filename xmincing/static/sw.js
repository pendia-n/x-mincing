const cacheName = 'xmincing-offline-v2';
const offlinePath = '/offline';

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(cacheName).then((cache) => cache.add(offlinePath)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		const keys = await caches.keys();
		await Promise.all(keys.filter((key) => key.startsWith('xmincing-offline-') && key !== cacheName)
			.map((key) => caches.delete(key)));
		await self.clients.claim();
	})());
});

self.addEventListener('fetch', (event) => {
	if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
	event.respondWith(fetch(event.request).catch(async () => {
		const cache = await caches.open(cacheName);
		return (await cache.match(offlinePath)) || Response.error();
	}));
});
