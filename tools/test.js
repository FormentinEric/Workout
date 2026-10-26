#!/usr/bin/env node
/* Test end-to-end della scheda con Playwright (Chromium), viewport 390×844.

  node tools/test.js              # tutti i test
  node tools/test.js foto offline # solo i test il cui nome contiene una di queste parole

Serve la cartella del repository su http://localhost:<porta>/Workout/ (come GitHub Pages),
simula gli endpoint Dropbox in memoria e fallisce se compaiono pageerror o errori in console.
Richiede il pacchetto `playwright` con Chromium installato.
*/
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const BASE = '/Workout/';
const KEY = 'scheda-elastici-v1', HKEY = 'scheda-storico-v1', PKEY = 'scheda-foto-v1', DKEY = 'scheda-dropbox-v1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
// PNG 2×2 rossa, per le foto.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGN8EBXFwMDAxMDAwMDAAAAToAGYWBgs8AAAAABJRU5ErkJggg==', 'base64');

// Server statico; `rewrite(testo)` permette di simulare una nuova pubblicazione di index.html.
function serve() {
  return new Promise(res => {
    const api = { rewrite: null };
    const srv = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]);
      if (!p.startsWith(BASE)) { r.writeHead(404); return r.end(); }
      const f = path.join(ROOT, p.slice(BASE.length) || 'index.html');
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      if (api.rewrite && f.endsWith('index.html')) return r.end(api.rewrite(fs.readFileSync(f, 'utf8')));
      fs.createReadStream(f).pipe(r);
    });
    srv.listen(0, 'localhost', () => res(Object.assign(api, {
      url: `http://localhost:${srv.address().port}${BASE}`,
      close: () => new Promise(ok => { srv.closeAllConnections(); srv.close(ok); }),
    })));
  });
}

// Dropbox simulato: un solo file con rev, 409 per i conflitti, CORS come l'API vera.
function dropbox() {
  const st = { file: null, rev: 0, uploads: 0, conflicts: 0, codes: new Set(['code-ok', 'code-2']) };
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Dropbox-API-Arg',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'Dropbox-API-Result',
  };
  const json = (route, status, body) => route.fulfill({ status, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  st.handle = async route => {
    const q = route.request(), u = new URL(q.url());
    if (q.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: cors, body: '' });
    if (u.pathname === '/oauth2/token') {
      const f = new URLSearchParams(q.postData() || '');
      if (f.get('grant_type') === 'authorization_code') {
        if (!st.codes.has(f.get('code')) || !f.get('code_verifier')) return json(route, 400, { error: 'invalid_grant', error_description: 'code doesn’t exist or has expired' });
        st.codes.delete(f.get('code'));
        return json(route, 200, { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 14400, token_type: 'bearer' });
      }
      return json(route, 200, { access_token: 'at-2', expires_in: 14400, token_type: 'bearer' });
    }
    if (u.pathname === '/2/auth/token/revoke') return json(route, 200, null);
    const arg = JSON.parse(q.headers()['dropbox-api-arg'] || '{}');
    if (u.pathname === '/2/files/download') {
      if (!st.file) return json(route, 409, { error_summary: 'path/not_found/..' });
      return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/octet-stream', 'Dropbox-API-Result': JSON.stringify({ rev: 'r' + st.rev }) }, body: st.file });
    }
    if (u.pathname === '/2/files/upload') {
      const m = arg.mode || {};
      if (st.conflicts > 0 || (m['.tag'] === 'add' && st.file) || (m['.tag'] === 'update' && m.update !== 'r' + st.rev)) {
        if (st.conflicts > 0) st.conflicts--;
        return json(route, 409, { error_summary: 'path/conflict/file/..' });
      }
      st.file = q.postDataBuffer().toString('utf8'); st.rev++; st.uploads++;
      return json(route, 200, { rev: 'r' + st.rev, path_display: arg.path });
    }
    return json(route, 404, {});
  };
  st.data = () => st.file && JSON.parse(st.file);
  return st;
}

class Session {
  static async open(env, opts = {}) {
    const s = new Session();
    s.ctx = await env.browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: opts.sw ? 'allow' : 'block' });
    s.dbx = opts.dbx || dropbox();
    await s.ctx.route(/^https:\/\/(api|content)\.dropboxapi\.com\//, s.dbx.handle);
    if (opts.init) await s.ctx.addInitScript(opts.init);
    s.pg = await s.ctx.newPage();
    s.errs = []; s.dialogs = [];
    s.pg.on('pageerror', e => s.errs.push('pageerror: ' + e.message));
    s.pg.on('console', m => {
      if (m.type() !== 'error') return;
      // I 409 di Dropbox (file assente, conflitto di rev) sono risposte previste dal protocollo.
      if (/status of 409/.test(m.text()) && /dropboxapi\.com/.test(m.location().url)) return;
      s.errs.push('console: ' + m.text() + ' ' + m.location().url);
    });
    s.pg.on('dialog', d => { s.dialogs.push(d.message()); d.dismiss().catch(() => {}); });
    s.url = (opts.server || env.server).url;
    if (opts.seed) {
      // Stato salvato prima del primo avvio: si scrive da una pagina vuota della stessa origine.
      await s.ctx.route(s.url + '__seed', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>seed</title>' }));
      await s.pg.goto(s.url + '__seed');
      await s.pg.evaluate(seed => { Object.entries(seed).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))); }, opts.seed);
    }
    return s;
  }
  async load() {
    await this.pg.goto(this.url);
    await this.nav.getByRole('button').first().waitFor({ timeout: 15000 });
  }
  get nav() { return this.pg.getByRole('navigation', { name: 'Sezioni' }); }
  tab(name) { return this.nav.locator('button', { hasText: name }).click(); }
  card(name) { return this.pg.locator('article').filter({ has: this.pg.locator('h3', { hasText: new RegExp('^' + name + '$') }) }); }
  async openProg(name) {
    await this.tab('Programmi');
    await this.pg.locator('article').filter({ hasText: name }).getByRole('button', { name: /Inizia|Riprendi/ }).click();
    await this.pg.getByRole('button', { name: 'Concludi seduta' }).waitFor();
  }
  ls(k) { return this.pg.evaluate(k => localStorage.getItem(k), k); }
  async lsJson(k) { const v = await this.ls(k); return v == null ? null : JSON.parse(v); }
  photos() {
    return this.pg.evaluate(() => new Promise((res, rej) => {
      const q = indexedDB.open('scheda-foto', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('foto');
      q.onsuccess = () => { const out = {}, c = q.result.transaction('foto').objectStore('foto').openCursor(); c.onsuccess = () => { const r = c.result; if (r) { out[r.key] = r.value; r.continue(); } else { q.result.close(); res(out); } }; };
      q.onerror = () => rej(q.error);
    }));
  }
  until(fn, what, ms = 8000) { return until(fn, what, ms); }
  async close() {
    assert.deepStrictEqual(this.errs, [], 'errori nella pagina');
    await this.ctx.close();
  }
}

async function until(fn, what, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    let v; try { v = await fn(); } catch (e) { v = false; }
    if (v) return v;
    if (Date.now() > end) throw new Error('timeout: ' + what);
    await new Promise(r => setTimeout(r, 100));
  }
}

// Seduta già nello storico, per i test che partono da dati salvati.
const OLD_SESSION = { id: 'lun-1000', day: 'lun', pname: 'Lunedì', t: 1000, start: null, auto: false, dn: 1, tot: 43,
  items: [{ slot: 'corda', ex: 'corda', name: 'Salto corda', met: 'r', sets: [{ n: 1, kg: '', v: '2', ok: true, e: '', b: '' }], log: '' }] };

const TESTS = [];
const test = (name, fn) => TESTS.push({ name, fn });

test('avvio e navigazione', async env => {
  const s = await Session.open(env);
  await s.load();
  await s.pg.getByText('Scegli la routine da fare').waitFor();
  for (const [tab, txt] of [['Mese', 'Torna al mese corrente|Nessun allenamento salvato'], ['Storico', 'Sincronizzazione Dropbox'], ['Elastici', 'Aggiungi elastico'], ['Regole', 'Suono a fine recupero'], ['Editor', 'Nuovo programma'], ['Programmi', 'Scegli la routine da fare']]) {
    await s.tab(tab);
    await s.pg.getByText(new RegExp(txt)).first().waitFor();
  }
  await s.openProg('Lunedì');
  await s.pg.getByRole('button', { name: 'Una serie alla volta' }).click();
  await s.pg.getByText('Salta serie').waitFor();
  await s.pg.getByRole('button', { name: 'Lista' }).click();
  await s.close();
});

test('seduta conclusa nello storico', async env => {
  const s = await Session.open(env);
  await s.load();
  await s.openProg('Lunedì');
  const c = s.card('Lat pulldown in ginocchio \\(ancoraggio alto\\)');
  await c.getByRole('button', { name: '1', exact: true }).click();
  await c.getByRole('button', { name: '2', exact: true }).click();
  await s.pg.getByRole('button', { name: 'Concludi seduta' }).click();
  await s.pg.getByRole('button', { name: 'Salva e azzera' }).click();
  const h = await s.until(async () => { const h = await s.lsJson(HKEY); return h && h.length && h; }, 'seduta nello storico');
  assert.strictEqual(h[0].day, 'lun');
  assert.deepStrictEqual(h[0].items.map(i => i.ex), ['latpd']);
  assert.strictEqual(h[0].items[0].sets.length, 2);
  await s.close();
});

test('spunta senza scrivere: salva i valori proposti', async env => {
  const prev = { ...OLD_SESSION, id: 'lun-2000', t: 2000, items: [{ slot: 'latpd', ex: 'latpd', name: 'Lat pulldown', met: 'r', log: '',
    sets: ['13', '13', '12', '12'].map((v, i) => ({ n: i + 1, kg: '18', v, ok: true, e: 'g', b: '' })) }] };
  const s = await Session.open(env, { seed: { [HKEY]: [prev], [KEY]: { ver: 2, bands: [{ id: 'b1', name: 'Rosso', kg: '9', col: '#e05a5a' }], bandHint: false } } });
  await s.load();
  await s.openProg('Lunedì');
  const lat = s.card('Lat pulldown in ginocchio \\(ancoraggio alto\\)');
  await lat.getByPlaceholder('13').first().fill('15');            // valore scritto: non va sovrascritto
  for (const n of ['1', '2', '3']) await lat.getByRole('button', { name: n, exact: true }).click();
  await lat.getByRole('button', { name: /Rosso/ }).click();        // con gli elastici i kg arrivano dalla combinazione
  await lat.getByRole('button', { name: '4', exact: true }).click();
  await s.card('Chest press \\(ancoraggio all’altezza del petto\\)').getByRole('button', { name: '1', exact: true }).click();
  await s.card('Salto corda').getByRole('button', { name: '1', exact: true }).click();
  await s.pg.getByRole('button', { name: 'Concludi seduta' }).click();
  await s.pg.getByRole('button', { name: 'Salva e azzera' }).click();
  const h = await s.until(async () => { const h = await s.lsJson(HKEY); return h && h.length === 2 && h; }, 'seduta salvata');
  const by = Object.fromEntries(h[0].items.map(i => [i.ex, i.sets.map(z => [z.kg, z.v])]));
  assert.deepStrictEqual(by.latpd, [['18', '15'], ['18', '13'], ['18', '12'], ['9', '12']]);
  assert.deepStrictEqual(by.chest, [['', '12']], 'senza storico: minimo dell’obiettivo');
  assert.deepStrictEqual(by.corda, [['', '2:00']], 'esercizio a tempo: tempo dell’obiettivo');
  await s.close();
});

test('dati vecchi: migrazione dello stato e delle foto', async env => {
  const foto = 'data:image/png;base64,' + PNG.toString('base64');
  const s = await Session.open(env, { seed: {
    [KEY]: { tab: 'programmi', done: { 'lun-1-0': 1 }, sv: { 'lun-1-0': { v: '12' } }, cur: { lun: 1 } },
    [PKEY]: { latpd: foto },
  } });
  await s.load();
  const st = await s.until(async () => { const v = await s.lsJson(KEY); return v && v.ver === 2 && v; }, 'stato migrato');
  assert.deepStrictEqual(st.done, { 'lun-latpd-0': 1 });
  assert.deepStrictEqual(st.sv, { 'lun-latpd-0': { v: '12' } });
  const ph = await s.until(async () => { const p = await s.photos(); return p.latpd && p; }, 'foto in IndexedDB');
  assert.strictEqual(ph.latpd, foto);
  await s.until(async () => (await s.ls(PKEY)) === null, 'foto tolte da localStorage');
  await s.openProg('Lunedì');
  await s.card('Lat pulldown in ginocchio \\(ancoraggio alto\\)').getByRole('img', { name: 'La tua esecuzione' }).waitFor();
  await s.close();
});

test('foto salvate in IndexedDB', async env => {
  const s = await Session.open(env);
  await s.load();
  await s.openProg('Lunedì');
  const c = s.card('Salto corda');
  await c.locator('input[type=file]').setInputFiles({ name: 'f.png', mimeType: 'image/png', buffer: PNG });
  await c.getByRole('img', { name: 'La tua esecuzione' }).waitFor();
  const ph = await s.until(async () => { const p = await s.photos(); return p.corda && p; }, 'foto in IndexedDB');
  assert.match(ph.corda, /^data:image\/jpeg;base64,/);
  assert.strictEqual(await s.ls(PKEY), null);
  await s.load();
  await s.openProg('Lunedì');
  await s.card('Salto corda').getByRole('img', { name: 'La tua esecuzione' }).waitFor();
  await s.card('Salto corda').getByRole('button', { name: 'Rimuovi' }).click();
  await s.until(async () => !(await s.photos()).corda, 'foto rimossa');
  await s.close();
});

test('memoria piena: avviso una volta sola', async env => {
  const s = await Session.open(env, { init: () => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (window.__full && k === 'scheda-elastici-v1') throw new DOMException('pieno', 'QuotaExceededError');
      return set.call(this, k, v);
    };
  } });
  await s.load();
  await s.openProg('Lunedì');
  const c = s.card('Salto corda');
  await s.pg.evaluate(() => { window.__full = true; });
  await c.getByRole('button', { name: '1', exact: true }).click();
  await s.until(() => s.dialogs.length === 1, 'primo avviso');
  assert.match(s.dialogs[0], /Memoria del browser piena/);
  await c.getByRole('button', { name: '1', exact: true }).click();
  await s.pg.waitForTimeout(300);
  assert.strictEqual(s.dialogs.length, 1, 'l’avviso non si ripete finché la memoria resta piena');
  await s.pg.evaluate(() => { window.__full = false; });
  await c.getByRole('button', { name: '1', exact: true }).click();
  await s.pg.evaluate(() => { window.__full = true; });
  await c.getByRole('button', { name: '1', exact: true }).click();
  await s.until(() => s.dialogs.length === 2, 'nuovo avviso dopo un salvataggio riuscito');
  await s.close();
});

test('dropbox: collegamento, invio, ripristino, conflitto ed eliminazioni', async env => {
  const dbx = dropbox();
  const a = await Session.open(env, { dbx, seed: { [HKEY]: [OLD_SESSION] } });
  await a.load();
  await a.openProg('Lunedì');
  await a.card('Salto corda').getByRole('button', { name: '1', exact: true }).click();
  await a.tab('Storico');
  await a.pg.getByPlaceholder('dalla pagina Settings della tua app Dropbox').fill('chiave-app');
  const link = a.pg.getByRole('link', { name: /Apri Dropbox/ });
  await a.until(async () => /client_id=chiave-app&.*code_challenge_method=S256/.test(await link.getAttribute('href')), 'link di autorizzazione');
  await a.pg.getByPlaceholder('incolla qui il codice').fill('code-ok');
  await a.pg.getByRole('button', { name: 'Collega Dropbox' }).click();
  await a.pg.getByRole('button', { name: 'Sincronizza ora' }).waitFor();
  const d = await a.until(() => dbx.data(), 'file caricato su Dropbox');
  assert.strictEqual(d.app, 'scheda-allenamento');
  assert.ok(JSON.parse(d.main).done['lun-corda-0'], 'serie spuntata nel file');
  assert.deepStrictEqual(d.hist.map(h => h.id), ['lun-1000']);
  assert.strictEqual((await a.lsJson(DKEY)).rt, 'rt-1');

  // Conflitto: il primo upload riceve 409, il secondo deve riuscire.
  dbx.conflicts = 1;
  const before = dbx.uploads;
  await a.tab('Programmi');
  await a.openProg('Lunedì');
  await a.card('Lat pulldown in ginocchio \\(ancoraggio alto\\)').getByRole('button', { name: '1', exact: true }).click();
  await a.until(() => dbx.uploads > before && dbx.conflicts === 0, 'upload dopo il conflitto', 12000);
  assert.ok(JSON.parse(dbx.data().main).done['lun-latpd-0']);

  // Secondo dispositivo: stesso Dropbox, dati locali vuoti.
  const b = await Session.open(env, { dbx });
  await b.load();
  await b.tab('Storico');
  await b.pg.getByPlaceholder('dalla pagina Settings della tua app Dropbox').fill('chiave-app');
  await b.pg.getByPlaceholder('incolla qui il codice').fill('code-2');
  await b.pg.getByRole('button', { name: 'Collega Dropbox' }).click();
  await b.until(async () => { const v = await b.lsJson(KEY); return v && v.done && v.done['lun-latpd-0']; }, 'dati ripristinati sul secondo dispositivo');
  assert.deepStrictEqual((await b.lsJson(HKEY)).map(h => h.id), ['lun-1000']);

  // Eliminazione sul secondo dispositivo: finisce in tomb e sparisce anche dal primo.
  const ses = b.pg.locator('#ses-lun-1000');
  await ses.getByRole('button').first().click();
  await ses.getByRole('button', { name: /Elimina seduta/ }).click();
  await ses.getByRole('button', { name: /Tocca di nuovo per eliminare/ }).click();
  await b.until(() => { const f = dbx.data(); return f.tomb.includes('lun-1000') && !f.hist.length; }, 'eliminazione su Dropbox', 12000);
  await a.tab('Storico');
  await a.pg.getByRole('button', { name: 'Sincronizza ora' }).click();
  await a.until(async () => (await a.lsJson(HKEY)).length === 0, 'eliminazione arrivata sul primo dispositivo');
  await a.close();
  await b.close();
});

test('icona per la Home e titolo', async env => {
  const s = await Session.open(env);
  const html = await (await s.ctx.request.get(s.url)).text();
  assert.match(html.slice(0, 400), /<title>Allenamento<\/title>\s*<link rel="apple-touch-icon" href="apple-touch-icon.png">/, 'nella pagina servita');
  await s.load();
  assert.strictEqual(await s.pg.title(), 'Allenamento');
  const size = await s.pg.evaluate(() => new Promise((res, rej) => {
    const l = document.querySelector('link[rel="apple-touch-icon"]');
    if (!l) return rej(new Error('link mancante dopo l’avvio'));
    const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => rej(new Error('icona non caricata')); im.src = l.href;
  }));
  assert.deepStrictEqual(size, [180, 180]);
  await s.close();
});

test('uso offline con il service worker', async env => {
  const server = await env.serve();
  const s = await Session.open(env, { sw: true, server });
  await s.load();
  await s.until(() => s.pg.evaluate(() => !!navigator.serviceWorker.controller), 'service worker attivo');
  await s.until(() => s.pg.evaluate(async () => !!(await (await caches.open('scheda-v1')).match(new URL('./', location.href).href))), 'pagina in cache');

  // Nuova pubblicazione: con la rete disponibile arriva subito, non dalla copia salvata.
  server.rewrite = t => t.replace("'Scegli la routine da fare'", "'Scegli la routine da fare (nuova versione)'");
  await s.load();
  await s.pg.getByText('Scegli la routine da fare (nuova versione)').waitFor();

  // Senza rete: si apre l’ultima versione salvata, icona compresa.
  await server.close();
  await s.load();
  await s.pg.getByText('Scegli la routine da fare (nuova versione)').waitFor();
  assert.strictEqual(await s.pg.title(), 'Allenamento');
  assert.ok(await s.pg.evaluate(() => fetch('apple-touch-icon.png').then(r => r.ok)), 'icona dalla cache');
  await s.openProg('Lunedì');
  await s.close();
});

async function editProg(s, name) {
  await s.tab('Editor');
  // L’Editor riapre l’ultimo programma modificato: si torna all’elenco prima di sceglierlo.
  const back = s.pg.getByRole('button', { name: /Tutti i programmi/ });
  if (await back.count()) await back.click();
  await s.pg.getByRole('button', { name: new RegExp('^' + name) }).first().click();
  await s.pg.getByText('Modifica il programma: le modifiche si salvano da sole').waitFor();
}

test('alternativa con serie e obiettivo propri', async env => {
  const s = await Session.open(env);
  await s.load();
  await editProg(s, 'Lunedì');
  // Blocco singolo: Chest press 4 × 12-15, nuova alternativa a tempo con 2 serie.
  await s.pg.getByRole('button', { name: /^Chest press/ }).click();
  await s.pg.getByRole('button', { name: 'Aggiungi alternativa' }).click();
  await s.pg.getByPlaceholder('Cerca un esercizio').fill('pike');
  await s.pg.getByRole('button', { name: /^Pike push-up/ }).click();
  const alt = s.pg.getByRole('button', { name: /^Pike push-up/ });
  await alt.click();
  await s.pg.getByText('Come l’esercizio di partenza: 4 × 12-15').waitFor();
  await s.pg.getByRole('button', { name: 'Propri', exact: true }).click();
  const box = s.pg.locator('div').filter({ has: alt }).filter({ hasText: 'Serie e obiettivo' }).last();
  await box.getByRole('button', { name: 'Meno' }).first().click();
  await box.getByRole('button', { name: 'Meno' }).first().click();
  await box.getByRole('button', { name: 'Tempo', exact: true }).click();
  await box.getByRole('button', { name: 'Più' }).last().click();
  await alt.filter({ hasText: '2 × 50s' }).waitFor();
  const ualt = (await s.lsJson(KEY)).ualt.chest;
  assert.strictEqual(ualt[0].id, 'pike');
  assert.strictEqual(ualt[0].sr, '2 × 50s');

  await s.openProg('Lunedì');
  await s.card('Chest press \\(ancoraggio all’altezza del petto\\)').getByRole('button', { name: 'Pike push-up', exact: true }).click();
  const c = s.card('Pike push-up');
  await c.getByText('2 × 50s', { exact: true }).waitFor();
  await c.getByRole('button', { name: /Avvia 0:50/ }).waitFor();
  assert.strictEqual(await c.getByRole('button', { name: '3', exact: true }).count(), 0, 'solo 2 serie');
  await c.getByRole('button', { name: '1', exact: true }).click();
  await c.getByRole('button', { name: '2', exact: true }).click();
  await s.pg.getByText(/^2 \/ \d+ serie$/).waitFor();
  await s.pg.getByRole('button', { name: 'Concludi seduta' }).click();
  await s.pg.getByRole('button', { name: 'Salva e azzera' }).click();
  const h = await s.until(async () => { const h = await s.lsJson(HKEY); return h && h.length && h; }, 'seduta salvata');
  assert.deepStrictEqual(h[0].items.map(i => [i.ex, i.met, i.sets.length]), [['pike', 't', 2]]);
  assert.strictEqual(h[0].tot, 41, 'totale serie con la variante da 2 serie al posto di 4');
  await s.openProg('Lunedì');
  await s.pg.getByRole('button', { name: 'Una serie alla volta' }).click();
  await s.pg.getByText('1 di 41', { exact: true }).waitFor();
  await s.pg.getByRole('button', { name: 'Lista' }).click();

  // Superset: le serie restano quelle dei giri, cambia solo l’obiettivo.
  await editProg(s, 'Lunedì');
  await s.pg.getByRole('button', { name: /^Face pull/ }).click();
  const fp = s.pg.getByRole('button', { name: /^Tirata dell’elastico dietro la nuca/ });
  await fp.click();
  await s.pg.getByRole('button', { name: 'Propri', exact: true }).click();
  await s.pg.getByText('In questo blocco le serie seguono i giri.').waitFor();
  const fbox = s.pg.locator('div').filter({ has: fp }).filter({ hasText: 'Serie e obiettivo' }).last();
  await fbox.getByRole('button', { name: 'Max', exact: true }).click();
  await fp.filter({ hasText: '3 × max' }).waitFor();
  await s.openProg('Lunedì');
  await s.card('Face pull').getByRole('button', { name: 'Dietro la nuca', exact: true }).click();
  const t = s.card('Tirata dell’elastico dietro la nuca');
  await t.getByText('3 × max', { exact: true }).waitFor();
  assert.strictEqual(await t.getByRole('button', { name: '3', exact: true }).count(), 1);

  // Ritorno all’originale: la variante eredita di nuovo serie e obiettivo.
  await editProg(s, 'Lunedì');
  await s.pg.getByRole('button', { name: /^Face pull/ }).click();
  await fp.click();
  await s.pg.getByRole('button', { name: 'Come l’originale', exact: true }).click();
  await fp.filter({ hasText: 'Come l’esercizio di partenza: 3 × 15-20' }).waitFor();
  assert.strictEqual((await s.lsJson(KEY)).ualt.facepull[0].sr, undefined);
  await s.close();
});

test('figura degli esercizi personalizzati', async env => {
  const s = await Session.open(env);
  await s.load();
  await editProg(s, 'Lunedì');
  await s.pg.getByRole('button', { name: 'Aggiungi esercizio' }).first().click();
  await s.pg.getByPlaceholder('Nome dell’esercizio').fill('Affondo laterale');
  await s.pg.getByRole('button', { name: 'Quadricipiti', exact: true }).last().click();
  await s.pg.getByRole('button', { name: 'Corpo libero', exact: true }).click();
  await s.pg.getByRole('button', { name: 'Crea e aggiungi', exact: true }).click();
  await s.pg.getByText('Generica', { exact: true }).waitFor();

  await s.openProg('Lunedì');
  const c = s.card('Affondo laterale');
  await c.getByRole('img', { name: 'Figura generica' }).waitFor();

  await editProg(s, 'Lunedì');
  await s.pg.getByRole('button', { name: /^Affondo laterale/ }).click();
  await s.pg.getByRole('button', { name: 'Scegli figura' }).click();
  await s.pg.getByText(/^Per “Affondo laterale”/).waitFor();
  assert.strictEqual(await s.pg.getByText('Crea un esercizio nuovo').count(), 0, 'niente creazione nel selettore delle figure');
  await s.pg.getByPlaceholder('Cerca un esercizio').fill('squat con');
  await s.pg.getByRole('button', { name: /^Squat con elastico/ }).click();
  await s.pg.getByText('Come “Squat con elastico”').waitFor();
  const cex = Object.values((await s.lsJson(KEY)).cex)[0];
  assert.strictEqual(cex.fig, 'squat');

  await s.openProg('Lunedì');
  const imgs = c.locator('figure [role=img]');
  await s.until(async () => (await imgs.count()) >= 2, 'figure dello squat');
  assert.strictEqual(await c.getByRole('img', { name: 'Figura generica' }).count(), 0);

  await editProg(s, 'Lunedì');
  await s.pg.getByRole('button', { name: /^Affondo laterale/ }).click();
  await s.pg.getByRole('button', { name: 'Usa la generica' }).click();
  await s.pg.getByText('Generica', { exact: true }).waitFor();
  assert.strictEqual(Object.values((await s.lsJson(KEY)).cex)[0].fig, undefined);
  await s.close();
});

async function main() {
  const only = process.argv.slice(2).map(x => x.toLowerCase());
  const list = TESTS.filter(t => !only.length || only.some(o => t.name.toLowerCase().includes(o)));
  const env = { browser: await chromium.launch(), server: await serve(), serve };
  let fail = 0;
  for (const t of list) {
    const t0 = Date.now();
    try { await t.fn(env); console.log(`✓ ${t.name} (${Date.now() - t0} ms)`); }
    catch (e) { fail++; console.log(`✗ ${t.name}\n  ${String(e && e.stack || e).split('\n').slice(0, 6).join('\n  ')}`); }
  }
  await env.browser.close(); await env.server.close();
  console.log(fail ? `${fail} test falliti su ${list.length}` : `${list.length} test superati`);
  process.exit(fail ? 1 : 0);
}
main();
