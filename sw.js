const CACHE = 'quran-sign-language-v3';
const OFFLINE_FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './pdf.mjs', './pdf.worker.mjs', './full-quran.pdf', './page-9.jpg'];
const REUSE_FILES = ['./icon-180.png', './icon-192.png', './icon-512.png', './full-quran.pdf', './page-9.jpg'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(OFFLINE_FILES.filter(file => !REUSE_FILES.includes(file)));
    for (const file of REUSE_FILES) {
      const url = new URL(file, self.registration.scope);
      let response = await caches.match(url);
      if (!response) response = await fetch(url);
      if (!response.ok || response.status !== 200) throw new Error(`Could not cache ${file}`);
      await cache.put(url, response.clone());
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('quran-sign-language-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const range = request.headers.get('Range');
    if (range && url.pathname.endsWith('/full-quran.pdf')) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      const cached = await caches.match(url);
      if (match && cached) {
        const blob = await cached.blob();
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
        if (start >= blob.size || start > end) return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${blob.size}`}});
        return new Response(blob.slice(start, end + 1), {status: 206, headers: {
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${blob.size}`,
          'Content-Length': String(end - start + 1),
          'Content-Type': 'application/pdf'
        }});
      }
    }
    return await caches.match(request) || fetch(request);
  })());
});
