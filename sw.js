/*
 * Offline shell for the installable app.
 *
 * Strategy: network first, cache as a fallback, so a new deployment is always
 * picked up immediately when the visitor is online. Only this origin's static
 * files plus the pinned CDN bundles are cached — Supabase traffic (auth, REST,
 * storage) and Google Fonts always go straight to the network. js/config.js is
 * never cached, otherwise a device could keep talking to a swapped project.
 */
'use strict'

const CACHE = 'salon-shell-v2'
const CDN = 'https://cdn.jsdelivr.net'
const SHELL = [
  './index.html',
  './manifest.webmanifest',
  './css/tailwind.css',
  './js/app.min.js',
  './js/i18n.min.js',
  './js/branding.js',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/apple-touch-icon.png',
  CDN + '/npm/@supabase/supabase-js@2',
  CDN + '/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  CDN + '/npm/alpinejs@3.14.1/dist/cdn.min.js'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Version-pinned libraries: serve from cache first so the app boots offline.
  if (url.origin === CDN) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
        return response
      }))
    )
    return
  }

  if (url.origin !== self.location.origin) return
  if (url.pathname.endsWith('/js/config.js')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  )
})
