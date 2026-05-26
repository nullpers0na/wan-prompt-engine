/* Cross-Origin Isolation Service Worker
 * Enables SharedArrayBuffer (required by ffmpeg.wasm multi-threading) by injecting
 * COOP/COEP headers into all responses, including the page navigation response.
 *
 * Flow:
 *  1. Page loads, SW not yet registered → registers this file as SW, reloads.
 *  2. Page loads again, SW intercepts the navigation and adds COOP/COEP headers.
 *  3. crossOriginIsolated === true → SharedArrayBuffer available.
 */

if (typeof window === 'undefined') {
  // ── Service Worker context ──────────────────────────────────────────────────
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', function (event) {
    // Ignore non-HTTP schemes (chrome-extension://, data:, etc.)
    if (!event.request.url.startsWith('http')) return;
    // Avoid hanging on cache-only cross-origin requests
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;

    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          // Opaque responses can't be cloned — pass through as-is
          if (!response || response.type === 'opaque' || response.status === 0) return response;

          const headers = new Headers(response.headers);
          headers.set('Cross-Origin-Opener-Policy', 'same-origin');
          headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
          headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        })
        .catch(() => fetch(event.request))
    );
  });
} else {
  // ── Main-thread context — register the SW then reload once ─────────────────
  if (!window.crossOriginIsolated && 'serviceWorker' in navigator) {
    navigator.serviceWorker
      .register(document.currentScript.src)
      .then(function () {
        if (!navigator.serviceWorker.controller) {
          // SW just installed for the first time; reload so it can control the page
          navigator.serviceWorker.addEventListener('controllerchange', function () {
            location.reload();
          });
        }
      })
      .catch(function (err) {
        console.warn('coi-serviceworker registration failed:', err);
      });
  }
}
