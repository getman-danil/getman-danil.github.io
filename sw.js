// Offline mode: keeps a copy of the site on the phone.
// Change VERSION after editing the site so phones pick up the new copy.
const VERSION = 'v1';
const CACHE = 'resume-' + VERSION;
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;600&family=Golos+Text:wght@400;500&family=JetBrains+Mono:wght@300;400&display=swap';
const FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

// Save the page, icons and fonts during install, so the first offline launch already looks right.
async function cacheFonts(cache) {
  try {
    const res = await fetch(FONT_CSS);
    if (!res.ok) return;
    await cache.put(FONT_CSS, res.clone());
    const css = await res.text();
    const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
    await Promise.all(urls.map(u => fetch(u).then(r => r.ok && cache.put(u, r)).catch(() => {})));
  } catch (e) { /* fonts fall back to system faces offline */ }
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await cache.addAll(FILES);
    await cacheFonts(cache);
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('resume-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // The page itself: try the network first so edits show up, fall back to the saved copy offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // Icons and fonts: use the saved copy, fetch and save anything new.
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  })));
});
