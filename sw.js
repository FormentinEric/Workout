/* Service worker della scheda: la pagina si apre anche senza rete.
   Rete prima di tutto, così ogni pubblicazione arriva subito. Se la rete non c'è, risponde
   con un errore o non risponde entro TIMEOUT, si usa l'ultima copia salvata (che la risposta
   di rete, se arriva, aggiorna comunque). Tocca solo le GET dentro la cartella della scheda:
   Dropbox e YouTube passano diretti. */
const CACHE = 'scheda-v1';
const TIMEOUT = 4000;
const SCOPE = new URL('./', self.location).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'apple-touch-icon.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('scheda-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const q = e.request;
  if (q.method !== 'GET' || !q.url.startsWith(SCOPE)) return;
  // Ogni apertura della pagina (/, /index.html, con o senza query) usa la stessa copia.
  const nav = q.mode === 'navigate', key = nav ? SCOPE : q;
  let stored = Promise.resolve();
  const net = fetch(nav ? new Request(SCOPE, { cache: 'no-cache' }) : q).then(async r => {
    const c = await caches.open(CACHE);
    if (r.ok) { stored = c.put(key, r.clone()); return r; }
    return (await c.match(key)) || r;
  });
  e.waitUntil(net.then(() => stored).catch(() => {}));
  e.respondWith(answer(net, key));
});

async function answer(net, key) {
  const saved = () => caches.open(CACHE).then(c => c.match(key));
  let timer;
  const late = new Promise(res => { timer = setTimeout(res, TIMEOUT); }).then(saved);
  try {
    return (await Promise.race([net, late])) || await net;
  } catch (err) {
    const old = await saved();
    if (old) return old;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
