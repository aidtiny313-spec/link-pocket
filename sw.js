'use strict';
const scope = self.registration.scope;
const prefix = 'link-pocket:' + scope + ':';
const cacheName = prefix + '1';
const assets = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icon.png', './icon-192.png', './icon-512.png'].map((file) => new URL(file, scope).href);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then(async (cache) => {
    const files = await Promise.all(assets.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok || response.redirected) throw new Error('App asset unavailable');
      return [url, response];
    }));
    await Promise.all(files.map(([url, response]) => cache.put(url, response)));
  }));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith(prefix) && key !== cacheName)
    .map((key) => caches.delete(key)))));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(scope)) return;
  if (request.mode === 'navigate') {
    const url = new URL(request.url);
    if (url.pathname !== new URL(scope).pathname &&
        url.pathname !== new URL('index.html', scope).pathname) return;
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(cacheName);
      return (await cache.match(assets[0])) ?? Response.error();
    }));
  } else if (assets.includes(request.url)) {
    event.respondWith(caches.open(cacheName).then(async (cache) =>
      (await cache.match(request)) ?? fetch(request)));
  }
});
