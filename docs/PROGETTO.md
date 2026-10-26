# Scheda allenamento — riepilogo del progetto

Riepilogo della chat in cui è nata la scheda (ottobre 2026). Il codice in `index.html` resta la fonte di verità. Questo documento spiega cosa fa la scheda, perché è fatta così e cosa resta da fare.

## Contesto
- **Utente**: si allena a casa con elastici e corpo libero, usa l'iPhone durante l'allenamento.
- **Attrezzatura disponibile**:
  - elastici con maniglie e ad anello, mini band;
  - ancoraggio alla porta;
  - sedie, divano, gradino, zaino o valigia per caricare, corda per saltare.
- **Non** ha più la barra pilates (da ottobre 2026): niente esercizi che la richiedono.

## Schermate (barra in basso: Programmi · Mese · Storico · Editor · Altro; nascosta durante la seduta)

La barra sta in fondo allo schermo, come nelle app iOS, sopra l'area del gesto Home. **Altro** raccoglie Elastici e Regole, che hanno “‹ Altro” in alto per tornare. Se un recupero resta attivo uscendo dalla seduta, il timer compare sopra la barra.

### Programmi
- Elenco delle routine. Per ognuna: nome, descrizione, numero di esercizi e di serie, quando è stata fatta l'ultima volta.
- Stato "In corso" con barra di avanzamento; tasti Inizia/Riprendi e Modifica.
- Una routine aperta apre la **schermata della seduta** (sotto). La barra delle sezioni è nascosta finché non si torna ai Programmi con la freccia in alto.

### Schermata della seduta (in stile Hevy, sostituisce la vecchia Lista)
- **In alto, fissa**: freccia per tornare ai Programmi, nome e descrizione della routine, timer di recupero (avvia il recupero della serie in corso), **Termina**. Sotto, lo stato di Dropbox (o “Dati salvati su questo telefono”).
- **Statistiche**: durata (dalla prima azione), volume (kg × ripetizioni delle serie fatte), serie fatte su totali, barra di avanzamento e pulsante **Guidata**/**Lista** per cambiare modalità.
- **Blocchi**: titolo del blocco; superset e circuiti hanno una barra viola a sinistra.
- **Ogni esercizio**:
  - miniatura rotonda (la tua foto se c'è, altrimenti la figura) e nome: toccandoli si apre la **scheda dettagli**;
  - menu ⋮: dettagli, cambia esercizio eseguito, copia i valori dell'ultima volta, azzera le serie dell'esercizio (doppio tocco);
  - chip: recupero (lo avvia), Nota (campo `logs`), esercizio eseguito (originale o alternativa, con dati separati per variante);
  - nota del programma, record in corso, stallo, suggerimento di progressione; elastici del catalogo con i kg sommati;
  - tabella **Serie · Precedente · Kg · Rip (o Tempo/Metri) · ✓**: “Precedente” è la serie dell'ultima volta; i campi mostrano gli stessi valori come segnaposto; negli esercizi a tempo ogni riga ha ▶ per avviare il tempo.
- **Spunta ✓**: avvia il recupero (nei superset “senza pausa” fino a fine giro). Se kg o valore sono vuoti salva quelli dell'ultima volta (o il minimo dell'obiettivo); i kg non si salvano se arrivano dagli elastici scelti.
- **Serie in corso**: la prima non fatta nell'ordine della seduta (nei superset e nei circuiti alterna gli esercizi, come la guidata) ha il bordo viola e il numero pieno; il suo esercizio mostra “In corso”.
- **Sforzo** (Facile, Giusta, Al limite): compare sotto la serie appena spuntata; toccando il numero di una serie fatta si riapre.
- **Aggiungi serie / Rimuovi**: serie in più o in meno solo per questa seduta (`xs`). “Rimuovi” toglie l'ultima serie se non è spuntata e non scende sotto 1. Lo stesso si fa scorrendo l'ultima serie verso sinistra (compare “Elimina” in rosso): oltre metà riga o con uno scatto si elimina, altrimenti torna al suo posto. Le altre righe non si scorrono, perché i dati delle serie sono indicizzati per numero di serie.
- **Scheda dettagli**: tua foto (con Rimuovi), disegno di wger se c'è (con autore e licenza), figure “Come si fa a casa”, oggetti e ancoraggio, nota, istruzioni, ultima volta con Copia, Video, Link, Aggiungi/Cambia foto.

### Figure e immagini
- **Figure** generate da `LIB[*].poses`: corpo pieno con contorno, arti lontani più scuri, oggetti di scena (porta, ancoraggio, sedia, box, zaino, elastico). Il muscolo principale (`MG`) è rosso, quelli citati nel testo `m` sono rosa (`muscles()`); di profilo il lato anteriore del busto si ricava da ginocchia e piedi (`frontOf()`).
- **Miniature** (`figThumb()`): prima posa, stessa scala per tutti gli esercizi.
- **Disegni wger** (`WGER`, file in `img/wger/`, crediti in `img/wger/CREDITS.md`): solo nella scheda dettagli, mai come miniatura. Sono 11 tavole di Everkinetic (CC BY-SA 3.0); per 9 l'attrezzo è diverso (manubri, cavi) e la scheda lo dice. Escluse in ottobre 2026: immagini generate con l'AI, con filigrane di terzi (HOIST, FitnessProgramer, weighttraining.guide), con fonte su siti commerciali, o di provenienza non verificabile.

### Modalità Una serie alla volta (guidata)
- Mostra una sola serie: nome, SERIE k/n, figure, obiettivo e recupero, ultima volta.
- Comandi:
  - elastici per singola serie (la scelta vale anche per le serie successive);
  - kg e ripetizioni con stepper, precompilati con i valori dell'ultima volta o con il minimo dell'obiettivo;
  - tasti Facile/Giusta/Al limite, che salvano, avviano il recupero e passano alla serie successiva.
- Ordine: nei superset e nei circuiti alterna gli esercizi (A1 → B1 → recupero → A2…); nei blocchi singoli fa tutte le serie di un esercizio prima del successivo.
- Esercizi a tempo: tasto Avvia; allo scadere bip, serie segnata da sola, avanti.
- Salta serie, Indietro/Avanti in basso, "Serie già completata" con Annulla.
- Si apre e si chiude con il pulsante Guidata/Lista della schermata della seduta, che resta in alto.

### Fine seduta
- **Termina** in alto apre una scheda: riepilogo, “Salva nello storico”, “Continua l’allenamento” e “Togli tutte le spunte” (doppio tocco). Salva nello storico serie, kg, valori, sforzo, elastici, variante, data e durata, poi azzera la routine. C'è Annulla finché non tocchi altro.
- Una seduta non conclusa viene archiviata in automatico il giorno dopo, con flag `auto`.
- Gli elastici usati nella prima serie diventano quelli di partenza della volta dopo.
- Il messaggio finale elenca i record battuti e ricorda il backup se ci sono 4 o più sedute non esportate.

### Mese
Calendario del mese con i giorni di allenamento (abbreviazione della routine) e frecce tra i mesi. Toccando un giorno o una riga dell'elenco si apre la seduta nello Storico.

### Storico
- **Sedute**: card espandibili, filtro per routine, badge Record, eliminazione con doppio tocco.
- **Esercizi**: una card per esercizio con grafico SVG dell'andamento (volume kg×ripetizioni se ci sono i kg, altrimenti totale di ripetizioni, tempo o metri) e i valori prima/ultima/record.
- **Settimana**: sedute e serie fatte rispetto al previsto per gruppo muscolare (mappa `MG`), con navigazione tra le settimane.
- **Sincronizzazione Dropbox** (vedi sotto).
- **Backup ed esportazione**:
  - Esporta backup: JSON v2 con `hist`, `logs`, `links`, `alt`, `bands`, `combo`, `progs`, `cex`, `ualt`, `sound`;
  - Esporta per Excel: CSV con `;` e BOM, una riga per serie, colonne Data, Ora, Programma, Esercizio, Serie, Kg, Valore, Unità, Sforzo, Elastici, Spuntata, Durata, Automatica;
  - Importa: unisce le sedute e ripristina programmi, esercizi personalizzati e alternative;
  - salvataggio dei file con condivisione iOS o download.

### Elastici (in Altro)
Catalogo con nome, colore (tocco sul cerchio per cambiarlo) e kg. Si elimina con doppio tocco.

### Regole (in Altro)
Impostazione del suono a fine recupero (tre bip con Web Audio, tasto Prova) e schede di regole (progressione, intensità, alternative, Dropbox…).

### Editor
- Elenco dei programmi con Modifica, Duplica ed Elimina; tasto Nuovo programma.
- **Programma**: nome, descrizione, "Conta nel riepilogo settimanale", Apri, Ripristina la versione originale (solo `lun`, `mer`, `ven`, `sab`).
- **Blocchi**: titolo, tipo (Singolo, Superset o Circuito), giri, recupero (passi di 15s), spostamento su/giù, eliminazione.
- **Esercizi**: ogni riga ha la miniatura dell'esercizio (`thumbOf()`, la stessa della seduta);
  - nome visualizzato, numero di serie;
  - obiettivo: Ripetizioni (min–max), Max, Tempo (passi di 5s) o Metri;
  - lato (per gamba, per braccio, per lato), kg di partenza, nota;
  - **Alternative**: aggiungi o rimuovi; per ognuna, serie e obiettivo dell'esercizio di partenza oppure propri (serie, ripetizioni, max, tempo o metri, lato). Nei superset e nei circuiti le serie seguono comunque i giri;
  - **Figura** (solo esercizi personalizzati): generica oppure presa da un esercizio esistente, scelta con la ricerca esercizi;
  - spostamento anche tra blocchi, Cambia esercizio, Elimina.
- **Ricerca esercizi**: testo e filtro per gruppo, ogni esercizio con la sua miniatura (la tua foto se c'è, altrimenti la figura); quelli già presenti nel programma sono disattivati. Si possono creare esercizi personalizzati (nome, gruppo, misura in ripetizioni/tempo/metri, attrezzo: elastico, pesi o corpo libero). Hanno una figura generica in piedi, con elastico o peso secondo l'attrezzo, finché non se ne sceglie una.
- Le modifiche si salvano da sole.

## Logiche principali
- **Progressione**, calcolata sull'ultima seduta dello stesso programma ed esercizio:
  - serie mancanti → completale prima di aumentare;
  - tutte al limite alto del range → aumenta la tensione;
  - tutte "facili" nel range → aumenta;
  - sotto il range e "al limite" → alleggerisci;
  - sotto il range e "facile" → spingi di più;
  - altrimenti +1 ripetizione.
  
  Per gli esercizi a tempo controlla il tempo pieno; per "max" mostra il totale da battere.
- **Stallo**: almeno 4 sedute e il massimo delle ultime 3 non supera il massimo precedente. Propone le alternative se esistono, altrimenti una tecnica diversa. Non compare se c'è un record in corso o un suggerimento di aumento.
- **Record**: metrica della seduta (stessa dei grafici) superiore al migliore precedente.
- **Recuperi**: dal blocco (`meta.rest`); nei superset e nei circuiti a fine giro.

## Modello dati
- **Programma**:
  ```
  {id, name, focus, plan, blocks:[{id, title, type:'single'|'superset'|'circuit', rounds, rest,
    items:[{ex, name, sets, mode:'reps'|'max'|'time'|'dist', lo, hi, secs, dist, side, kg, note}]}]}
  ```
- **Compilazione** (`compileProg`): righe `[bloccoId, exId, nome, sr, nota, kg]` con `sr` testuale (es. `4 × 12-15 per gamba`, `3 × 1:00`, `1 × 20 min`, `3 × 30 m`) più `meta[bloccoId] = {title, type, chain, giri, rest}`. Il resto del codice legge queste righe (`DAYS`).
- **I quattro programmi originali** stanno in `DAYS0` e vengono convertiti con `toProg()`.
- **Esercizi personalizzati**: `cex[id] = {name, grp, mode, band, kg, fig?}` → `LIB` tramite `applyCex()`. `fig` è l'ID di un esercizio di `LIB` di cui usare le pose (`figSrc()`); senza `fig` si usa `genFig()`.
- **Alternative**: `ALT_BASE` (fisse) più `ualt[exId] = [{id, short, name, sr?, note?, t?}]` tramite `applyUalt()`.
  - `t = {sets, mode, lo, hi, secs, dist, side}`: serie e obiettivo propri come li ha scritti l'utente; `sr` ne è la versione testuale (`rowSr(t,0)`), l'unica letta in allenamento. Senza `sr` la variante eredita quelli della riga.
  - `altSr()` applica `sr` alla riga; nei blocchi superset e circuito mantiene il numero di serie della riga (i giri). `dayRows(day, st)` usa la variante scelta per contare le serie.
- **Seduta nello storico**:
  ```
  {id:`${programma}-${t}`, day, pname, t, start, auto, dn, tot,
   items:[{slot, ex, name, met:'r'|'t'|'m', sets:[{n, kg, v, ok, e:'f'|'g'|'l'|'', b}], log}]}
  ```
- **Stato principale salvato**: `tab, done, sv, logs, links, mode, cur, alt, start, last, bands, combo, bandHint, eff, sound, lastExport, scombo, step, xs, progs, cex, ualt, ver:2`.
- **Serie in più o in meno della seduta**: `xs[`${programma}-${esercizio}`] = n` (anche negativo); il numero di serie è `nEff()` = pianificate + `xs`, almeno 1. Si azzera con la seduta (`clearTab`).
- **Stato solo in memoria** (non salvato): `sheet`, `effOpen`, `noteOpen`, `mnDel`, `rsDel`, `ask`.

## Avvio e app installata
- Icona sulla Home (`apple-touch-icon.png`), `manifest.webmanifest` con nome, colori e icone, meta per la modalità a tutto schermo.
- **Avvio senza lampi bianchi**: immagine di avvio di iOS (`img/avvio/`, una per misura di iPhone), poi la schermata di caricamento di `index.html`, poi la figura `#avvio` del template finché la scheda non è disegnata. Sono tutte uguali: fondo scuro e la stessa figura di 120 punti al centro, quindi il passaggio non si vede. Prima di ottobre 2026 il caricamento aveva fondo chiaro, la scritta "Unpacking…" e, per un istante, il markup grezzo del template.
- **Movimento**: le schede in basso entrano scivolando e si chiudono con la X, toccando fuori o trascinando in giù la parte alta (poco e piano tornano su); i pulsanti si attenuano mentre il dito è giù; righe delle serie, sforzo, timer e “Vai!” compaiono con transizioni brevi. Con “Riduci movimento” attivo in iOS non ci sono animazioni.
- **Tocco**: niente zoom con il doppio tocco (anche sulle conferme “tocca di nuovo”), niente selezione del testo né menu con la pressione lunga (tranne campi e link), niente rimbalzo della pagina, la pagina sotto una scheda non scorre. Il blocco del rimbalzo (`overscroll-behavior` sulla pagina) dipende dalla versione di iOS e non è stato provato su un iPhone.
- **Non verificato su iPhone**: in Chromium l'avvio è stato controllato fotogramma per fotogramma, ma il comportamento delle immagini di avvio dipende da iOS. Per vederle potrebbe servire togliere l'icona dalla Home e aggiungerla di nuovo. Le misure di iPhone 17 e Air sono state ricavate e non provate su un dispositivo.

## Senza rete
- `sw.js` salva `index.html` e l'icona. Con la rete la pagina arriva sempre da GitHub Pages, così una nuova pubblicazione si vede subito; senza rete, o se la rete non risponde entro 4s, si apre l'ultima copia salvata.
- I dati sono comunque nel browser: senza rete si allena e si salva tutto; Dropbox si sincronizza al ritorno della connessione.

## Sincronizzazione Dropbox
- **Collegamento**: PKCE S256, senza redirect URI. Dropbox mostra un codice che l'utente incolla, e funziona anche nella web app aperta dalla Home. Si usa `token_access_type=offline` per avere il refresh token. L'App key la inserisce l'utente.
- **File**: `/scheda-allenamento.json` con contenuto `{app:'scheda-allenamento', v:1, upd, saved, main:<stringa JSON dello stato>, hist:[…], tomb:[id…]}`.
- **Quando sincronizza**:
  - all'avvio;
  - al ritorno in primo piano, se sono passati più di 20s;
  - 4s dopo ogni modifica dei dati;
  - quando la pagina va in background con una sincronizzazione in sospeso.
- **Come**:
  - scarica e confronta, poi carica con `mode: update` e `rev`; in caso di 409 riprova;
  - stato principale: vince l'ultima modifica (`upd` contro `:t`), confrontando solo i dati (`dataOf`);
  - storico: unione per id, meno le tombstone.
- **Autorizzazione revocata**: la scheda si scollega e lo segnala; i dati locali restano.
- **Prove fatte**: collegamento, invio, ripristino su un secondo dispositivo, propagazione delle eliminazioni e revoca, tutti con un Dropbox simulato. **Mai provato con il vero Dropbox.**

## Cronologia delle decisioni
1. Tolta la barra pilates: esercizi con elastico tenuto per i capi.
2. Aggiunte alternative dai video dell'utente:
   - leg extension con mini band, al posto del sissy squat;
   - leg press supino, al posto del bulgarian;
   - tricipiti sopra la testa in ginocchio, al posto di triover e skull;
   - stacco con elastico ad anello;
   - kickback glutei;
   - leg curl prono e Nordic curl;
   - tirata dell'elastico dietro la nuca, al posto del face pull.
3. Storico, Mese, grafici, riepilogo settimanale, progressione, catalogo elastici, sforzo, stallo e record, suono, promemoria di backup.
4. Programma rivisto per coprire tutto il corpo:
   - calf raise al mercoledì e al venerdì;
   - alzate laterali al venerdì;
   - hip thrust e curl al sabato;
   - tolto l'hollow rock del venerdì;
   - i Mike Tyson push-up del mercoledì erano stati tolti e poi rimessi su richiesta (3 × 18-25).
5. Modalità guidata "una serie alla volta"; poi editor dei programmi, alternative modificabili, esportazione CSV.
6. Versione ospitata su Claude con salvataggio su cloud: costruita e poi **eliminata su richiesta**. Non riproporla. Il codice residuo (`cloudInit`, `cloudFlush`, download tramite `window.claude`) è stato rimosso.
7. Scelta finale: **GitHub Pages** (repository pubblico: il codice è leggibile, i dati no) più **Dropbox**.
8. Ottobre 2026, verso una sensazione da app nativa. Pagina alleggerita da 2,98 a 0,70 MB: il font delle icone resta solo in woff2 (letto da Safari su iOS 10 e successivi) e contiene solo le icone usate (`tools/bundle.py` lo rigenera). Con la CPU rallentata 4× in Chromium e la pagina servita in locale, la scheda è pronta in circa 0,9s invece di 1,6s (mediana di 9 aperture; misura fatta sul computer, non su iPhone). In più si scaricano 2,3 MB in meno.
9. Ridisegni più leggeri (misure con CPU rallentata 4× in Chromium, non su iPhone). Il profilo ha mostrato che il calcolo dei valori (`renderVals`) costa circa 1 ms: il tempo va nel runtime x-dc, in React e nel disegno. Per questo non è stato fatto il “ricalcolo del solo esercizio toccato”, proposto all'inizio: non avrebbe dato guadagni misurabili. Fatto invece:
   - timer: testo e barra aggiornati senza ridisegnare la pagina, da ~175 a ~3 ms di script al secondo durante il recupero;
   - spunta: classi CSS al posto degli stili inline ripetuti e `content-visibility` sulle card, da ~130 a ~87 ms di CPU per tocco.
   
   Le animazioni aggiunte dopo (punto 10) non cambiano il tempo di risposta al tocco (~58 ms per il ridisegno), ma aggiungono circa 50 ms di CPU distribuiti nei fotogrammi successivi.
10. Sensazione da app, sempre ottobre 2026: tocco senza zoom né selezione, schede animate e trascinabili, stato premuto, barra delle sezioni in basso con Altro, eliminazione dell'ultima serie scorrendo. Provato in Chromium con mouse e tocchi simulati, non su iPhone.

## Limiti noti e lavoro possibile
- **Già discusso ma non fatto**: calendario settimanale (programma per giorno), settimana di scarico, misure corporee e foto dei progressi, modalità "seduta breve".
- **Ogni tocco ridisegna tutta la pagina**: è il modo in cui funziona il runtime x-dc. Per andare oltre servirebbe dividere la scheda in più componenti o cambiare runtime.
- **Programmi e impostazioni** in conflitto tra dispositivi: vince l'ultima modifica, senza fusione campo per campo.
- **Disegni wger** solo per 11 esercizi; senza rete si vedono solo quelli già aperti almeno una volta (il service worker li salva al primo uso).
- **Foto** solo in locale, in IndexedDB (non in localStorage, che su Safari ha circa 5 MB per tutto il sito). Non vanno nel backup né su Dropbox.
- **Alternative** legate all'esercizio, non al programma: serie e obiettivo propri di una variante valgono in ogni programma in cui compare l'esercizio di partenza.
- Il nome dell'opzione Dropbox "Allow public clients" non è stato verificato: se esiste, deve restare su Allow.
