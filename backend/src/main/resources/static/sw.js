// Self-unregistering service worker to clear any stale workers on localhost
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => {
  self.registration.unregister();
});
