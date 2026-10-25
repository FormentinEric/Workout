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
  
  Gli ID degli esercizi in `LIB` e gli ID dei programmi originali (`lun`, `mer`, `ven`, `sab`) **non vanno mai rinominati**: storico, kg e record ci sono legati.
- Un esercizio può comparire **una sola volta per programma**. L'editor lo impone, perché i dati sono indicizzati per esercizio.
- Gli ID di programmi, blocchi e sedute non devono contenere `-`.
- Lo stato salvato deve restare compatibile all'indietro. Se cambi formato, aggiungi una migrazione in `migrate()` o `loadState()`.
- Sync Dropbox:
  - `dataOf()` esclude `tab`, `mode` e `cur`: la navigazione non conta come modifica;
  - `:t` va aggiornato solo quando cambiano i dati;
  - le sedute eliminate finiscono in `tomb`, altrimenti risorgono da un altro dispositivo.

## Test
Usa Playwright (Chromium) a 390×844:
- servi `index.html` intercettando `https://<utente>.github.io/scheda/` con `page.route`;
- simula gli endpoint Dropbox:
  - `api.dropboxapi.com/oauth2/token`;
  - `content.dropboxapi.com/2/files/download|upload`, con `rev` e 409 per i conflitti;
  - le intestazioni CORS, compresa l'esposizione di `dropbox-api-result`.

Verifica che non ci siano `pageerror` né errori in console. Per i dati vecchi, carica stati salvati con il formato precedente e controlla che vengano letti correttamente.

## Pubblicazione
- Repository GitHub pubblico, Pages: "Deploy from a branch" → `main` / root. URL: `https://<utente>.github.io/scheda/`.
- App Dropbox:
  - Scoped access, **App folder**;
  - permessi `files.content.read` e `files.content.write`;
  - nessun Redirect URI: la scheda usa PKCE e l'utente incolla il codice;
  - l'App key si inserisce nell'interfaccia (Storico → Sincronizzazione Dropbox), non nel codice.
- File su Dropbox: `/scheda-allenamento.json` dentro la cartella dell'app.
