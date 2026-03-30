self.addEventListener('install', e => {
  console.log('Service Worker installed');
});

self.addEventListener('fetch', e => {
  // אפשר להוסיף caching כאן בעתיד
});