# Scheda allenamento — istruzioni per Claude Code

App web personale per allenarsi a casa con elastici e corpo libero. Un solo file, `index.html`, pubblicato su GitHub Pages e usato come icona sulla schermata Home dell'iPhone. Dati nel browser (localStorage) e sincronizzati su Dropbox.

Dettagli completi (funzioni, modello dati, decisioni prese, limiti): @docs/PROGETTO.md

## Lingua e stile
- Rispondi in italiano. L'utente vuole risposte dense, precise e verificate: segnala ciò che non hai verificato.
- Testi dell'interfaccia in italiano con apostrofi e virgolette tipografiche (’ “ ”). Nel codice restano ' e ".
- Mobile first: viewport di riferimento 390×844, aree tattili di almeno 40px, tema scuro "Nocturne" (variabili CSS `--color-*`, accento `ACC='#9184d9'`).

## Come è fatto index.html (importante)
`index.html` è una "bundled page" esportata da Claude Design. Non modificarlo a mano.
- `<script type="__bundler/manifest">`: risorse (runtime x-dc, React 18, ReactDOM, font Inter e Phosphor) in base64, alcune gzip.
- `<script type="__bundler/template">`: **stringa JSON** con l'HTML interno. È qui che vive tutto il codice dell'app.
- Il bootstrap del bundle crea blob URL per le risorse e imposta `window.__resources`. Il runtime x-dc compila la logica con `new Function`.
- Eccezione: la `<head>` esterna contiene `<title>Allenamento</title>` e il link ad `apple-touch-icon.png`, aggiunti a mano (`pack` non li tocca). Gli stessi due tag sono anche nella `<head>` del template, perché il bootstrap sostituisce l'intero documento.

Flusso di modifica, sempre:
1. `python tools/bundle.py extract` → crea `build/template.html` (cartella ignorata da git).
2. Modifica `build/template.html`.
3. `python tools/bundle.py pack` → riscrive `index.html`.
4. `python tools/bundle.py check` → verifica che la codifica sia identica (json.dumps con `ensure_ascii=False` e `</` → `<\u002F`).
5. Testa, poi commit e push su `main` (GitHub Pages pubblica da `main`, cartella root).

## Struttura del template
- `<helmet>`: meta, CSS token e font.
- Markup con il linguaggio di template x-dc:
  - `{{ valore }}` per i binding, anche dentro `style` e `class`;
  - `<sc-if value="{{ bool }}" hint-placeholder-val="{{ true|false }}">`;
  - `<sc-for list="{{ array }}" as="x" hint-placeholder-count="N">`;
  - eventi `sc-camel-on-click`, `sc-camel-on-change` (input controllati, scattano a ogni tasto), `sc-camel-input-mode`.
- `<script type="text/x-dc" data-dc-script data-props="…">`: tutta la logica.
  - Costanti: `LIB` (55 esercizi con pose disegnate in SVG), `ALT`, `DAYS0`, `MG`, `RULES0`.
  - `class Component extends DCLogic`: lo stato si inizializza con `loadState()`; `this.save(patch|fn, cb)` aggiorna lo stato; `persist()` scrive in localStorage a ogni aggiornamento; `renderVals()` restituisce tutti i binding.
- Props del componente (`data-props`): `dettaglio` ("Completo" o "Solo figure"), `tracking`, `timerAuto`.
- **Regola**: ogni binding usato fuori da un `sc-for` deve avere un default nell'oggetto `base` di `renderVals()`, anche se compare solo in una sezione.
- **Immagini nel markup**: niente `<img src="{{ … }}">`. Il bootstrap inserisce il template nel documento prima dei binding e il browser scaricherebbe l'URL letterale `{{ … }}` (404 in console). Usare un `div` con `role="img"` e `background-image:{{ x }}`, dove il binding contiene tutto `url("…")`.
- Schermata della seduta: binding `wk*` (intestazione e statistiche), `sh*`/`mn*`/`al*` (scheda dettagli, menu, varianti, Termina), righe delle serie in `wkGroups[].items[].sets`.

## Invarianti da non rompere
- Chiavi localStorage:
  - `scheda-elastici-v1`: stato principale (JSON);
  - `scheda-elastici-v1:t`: ora dell'ultima modifica *dei dati*;
  - `scheda-storico-v1`: storico;
  - `scheda-foto-v1`: foto, solo nelle versioni vecchie. All'avvio vengono spostate in IndexedDB e la chiave viene cancellata;
  - `scheda-dropbox-v1`: token Dropbox, verificatore PKCE, rev, tombstone. Non va mai esportato nei backup.
- Foto: IndexedDB, database `scheda-foto`, archivio `foto`, chiave = ID dell'esercizio, valore = data URL JPEG. Se IndexedDB non è disponibile si torna a `scheda-foto-v1`.
- Chiavi dei dati delle serie:
  - serie: `${programmaId}-${esercizioId}-${k}`;
  - dati di una variante: aggiungere `~${altId}`.
  - serie in più o in meno della seduta: `xs[`${programmaId}-${esercizioId}`]`, azzerate a fine seduta.
  
  Gli ID degli esercizi in `LIB` e gli ID dei programmi originali (`lun`, `mer`, `ven`, `sab`) **non vanno mai rinominati**: storico, kg e record ci sono legati.
- Un esercizio può comparire **una sola volta per programma**. L'editor lo impone, perché i dati sono indicizzati per esercizio.
- Gli ID di programmi, blocchi e sedute non devono contenere `-`.
- Lo stato salvato deve restare compatibile all'indietro. Se cambi formato, aggiungi una migrazione in `migrate()` o `loadState()`.
- Sync Dropbox:
  - `dataOf()` esclude `tab`, `mode` e `cur`: la navigazione non conta come modifica;
  - `:t` va aggiornato solo quando cambiano i dati;
  - le sedute eliminate finiscono in `tomb`, altrimenti risorgono da un altro dispositivo.

## Test
`node tools/test.js` esegue tutti i test; `node tools/test.js foto dropbox` solo quelli con queste parole nel nome. Serve il pacchetto `playwright` con Chromium.
- Serve la cartella su `http://localhost:<porta>/Workout/`, come GitHub Pages, con viewport 390×844.
- Simula gli endpoint Dropbox:
  - `api.dropboxapi.com/oauth2/token`;
  - `content.dropboxapi.com/2/files/download|upload`, con `rev` e 409 per i conflitti;
  - le intestazioni CORS, compresa l'esposizione di `dropbox-api-result`.
- Fallisce se compaiono `pageerror` o errori in console. Fanno eccezione i 409 di Dropbox, previsti dal protocollo.
- Per i dati vecchi usa l'opzione `seed` di `Session.open`: carica stati salvati nel formato precedente e controlla che vengano letti correttamente.

Ogni modifica va coperta da un test in `tools/test.js`.

## Pubblicazione
- Repository GitHub pubblico, Pages: "Deploy from a branch" → `main` / root. URL: `https://<utente>.github.io/Workout/` (il percorso è il nome del repository).
- App Dropbox:
  - Scoped access, **App folder**;
  - permessi `files.content.read` e `files.content.write`;
  - nessun Redirect URI: la scheda usa PKCE e l'utente incolla il codice;
  - l'App key si inserisce nell'interfaccia (Storico → Sincronizzazione Dropbox), non nel codice.
- File su Dropbox: `/scheda-allenamento.json` dentro la cartella dell'app.
- `img/wger/`: disegni di Everkinetic da wger (CC BY-SA 3.0), elencati in `WGER` e in `img/wger/CREDITS.md`. Una nuova immagine va aggiunta in entrambi, con autore e licenza verificati: niente AI, filigrane o fonti commerciali.
- `sw.js` (service worker, registrato da `swInit()`): rete prima di tutto; se la rete manca, dà errore o non risponde entro 4s, usa l'ultima copia di `index.html` e dell'icona. Tocca solo le GET dentro la cartella della scheda. Se cambi il formato della cache, cambia il nome `CACHE`: le copie vecchie vengono cancellate all'attivazione.
