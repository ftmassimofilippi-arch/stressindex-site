# Changelog — Stress Index, sito e dashboard

Voci ricavate dalla storia git. Le migrazioni si applicano a mano; lo stato in
produzione è nel `README.md`.

## 2026-09-30 — tag `site-2026-09-30`

### PDF rifatti con i componenti della dashboard
- **Pagine di stampa** `/stampa/misurazione/[sessionId]`, `/stampa/report-periodico`
  e `/stampa/monitoraggio/[id]` (A4, moodboard Stress Index, header e footer
  su ogni pagina, disclaimer wellness) che riusano gauge, Poincaré,
  ritmogramma, PSD, torta VLF/LF/HF, tabella parametri con semaforo e range
  di riferimento, viste ortostatico/coerenza/lunga, `AdvancedTrendChart`
  statico. Prop `print` sui componenti (dimensioni fisse, niente animazioni
  né controlli).
- **Generazione con Chrome headless** (`puppeteer-core` + `@sparticuz/chromium`
  su Vercel): route `GET /api/pdf/misurazione/[sessionId]`,
  `/api/pdf/report-periodico`, `/api/pdf/monitoraggio/[id]`; token firmato a
  60 s, cookie di sessione inoltrati, attesa di `window.__REPORT_READY__`,
  nome file `StressIndex_[Cognome]_[tipo]_[data].pdf`. Vecchi generatori
  react-pdf dietro `PDF_LEGACY=true`.
- **Report periodico**: trend dei 5 score, medie con confronto col periodo
  precedente, giorno migliore/peggiore, commento automatico, elenco
  misurazioni, sezione Sport (Piano Pro).
- Dashboard: nuova torta VLF/LF/HF sotto lo spettro, semaforo e card
  "parametri nella norma / al limite / fuori range" nella tabella parametri,
  delta rispetto alla misurazione precedente sui gauge (in stampa).
- Dati di simulazione (`?fixture=`) fuori produzione e script
  `scripts/pdf-esempi*.mjs` per generare PDF di prova.
- Rifiniture: `PDF_TOKEN_SECRET` obbligatorio in produzione (500 senza),
  token monouso; variante cliente (`?variant=client`) per misurazione, report
  periodico e monitoraggio con le formulazioni del PDF legacy, bottone "PDF
  cliente" e opzione nella tab Report; PDF 24h senza salti pagina fissi;
  fixture sonno e 24h dal simulatore dell'app; `scripts/test-pdf-permessi.mjs`
  (19 controlli su permessi, token e sola lettura superadmin).

### Sito trilingue (i18n)
- **Italiano, inglese e tedesco** con `next-intl`: pagine spostate in
  `src/app/[locale]/`, italiano senza prefisso (URL invariate), `/en/...` e
  `/de/...` con gli stessi slug italiani. Middleware unico: routing per lingua
  (prefisso, poi cookie `NEXT_LOCALE`, poi `Accept-Language`) composto con la
  protezione Supabase di `/area-professionisti`, redirect che conservano la
  lingua. Switcher IT / EN / DE in navbar, footer, login, top bar della
  dashboard. 404 ed errore localizzati.
- **Tutte le stringhe visibili estratte** (~2.900 chiavi per lingua) in
  `messages/{it,en,de}.json`, generati dai frammenti
  `messages/_parts/<lingua>/<namespace>.<pacchetto>.json` con
  `scripts/i18n-merge.mjs`; `scripts/i18n-check.mjs` verifica chiavi allineate,
  termini vietati e trattini lunghi; `scripts/i18n-residui.mjs` cerca stringhe
  italiane residue. La guida è contenuto data-driven nel JSON con un renderer.
- **Glossario dall'app** (`docs/i18n-glossario.md`, ~600 voci) e convenzioni
  (`docs/i18n-convenzioni.md`). Terminologia allineata all'app: fascia stress
  85-100 "Affaticamento", score `score_modulazione_infiammatoria` mostrato come
  Adattamento / Adaptation / Anpassung.
- **Date, numeri e prezzi** per lingua con `Intl` (it-IT, en-US, de-DE) in
  `src/lib/format.ts` (parametro `locale` finale), anche su assi e tooltip
  Recharts e nei date picker; `formatEur` per i prezzi.
- **SEO**: `generateMetadata` per pagina e lingua (`src/lib/seo.ts`), hreflang
  it/en/de + x-default, sitemap con le tre lingue, `<html lang>` corretto,
  immagine OpenGraph tradotta.
- **Registrazione e auth**: lingua salvata in `user_metadata.locale`; errori
  Supabase Auth mappati su chiavi (`errors.supabase.*`); reset password verso
  `/imposta-password` nella lingua dell'utente. Template email Supabase IT/EN/DE
  con blocchi condizionali Go su `{{ .Data.locale }}` in `docs/email-templates/`
  (da incollare a mano nella dashboard).
- **Route API**: errori come codici stabili (`apiError`) tradotti lato client
  (`apiErrorMessage`); PDF, CSV ed email nella lingua della richiesta
  (`getRequestLocale`: `?locale=`, cookie, Referer, Accept-Language).
- **Linguaggio wellness** corretto anche in italiano (niente "clinico",
  "diagnosi", "paziente" fuori dai disclaimer legali); "Rischio infortunio" →
  "Rischio sovraccarico"; LF/HF sempre come "rapporto LF/HF".
- `.eslintrc.json` (`next/core-web-vitals`) per rendere `npm run lint` non
  interattivo.
- **Navigazione a un solo click**: righe di clienti, misurazioni, monitoraggi,
  sessioni sport, test soglie e coppie prima/dopo interamente cliccabili con
  veri `Link` (`LinkCell`, `DataTable.rowHref`; Cmd+click apre in nuova
  scheda), risultati della ricerca globale come link, card score e liste
  "da contattare"/"ultime misurazioni" cliccabili per intero; hover attivi
  solo con puntatore (`hoverOnlyWhenSupported`), feedback `:active` su touch,
  ancora "#" delle guide visibile anche senza hover.
- **Selettore lingua con bandierine SVG** (IT / EN / DE) a un click, sempre
  visibile: navbar accanto alla CTA anche su mobile, top bar della dashboard,
  pagine di autenticazione, versione testuale nel footer. Conserva path, query
  e ancora.

## 2026-09-27 — tag `site-2026-09-27`

Allineato all'app 2.9.0+52.

### Scheda cliente e misurazioni
- **Viste ortostatica e coerenza** allineate alla pagina risultati dell'app:
  indice di reattività, 14 parametri supino/in piedi con direzione attesa,
  score di coerenza, frequenza di risonanza, andamento nel tempo (b7d9a8e).
- **Scale fisse dei grafici** identiche all'app (RR 400–1400 ms, PSD
  10–1.000.000 ms²/Hz) con toggle "Zoom" per la scala adattiva (b7e19f5).
- **Filtri per etichetta e tipo di test**, tab **"Prima e dopo"** con coppie
  pre/post e confronto fra due sessioni `/clienti/[id]/confronto?a=&b=`
  (d813ebe).
- **Soglie avvisi per cliente** da `alert_rules` con la precedenza dell'app;
  letture separate dalla parte pura per i client component (6029d2f, aeaf05b).

### Sport
- **Dettaglio del test incrementale** con soglie VT1/VT2 stimate, IC95,
  scatter α1-FC, step, HRR60, zone proposte; sezione "Test soglie" nella
  scheda atleta con trend e storico (24d5248). Legge `threshold_test` (031) e
  i campi soglia di `clients` (032) senza ricalcolare.

### Accesso e sicurezza
- La route `/api/clienti/[id]/accesso` accetta anche un **Bearer token**, per
  l'app (3b85e02).
- Un account **sospeso o bloccato** non passa più da nessuna route
  `/api/clienti*` (978088e).
- **GDPR**: cancellare un utente non fallisce più per colpa del registro
  accessi; migrazione 028 (340745e).

### Migrazioni
- 023 esclusioni "da non unire", 024 commerciale (stato account, abbonamenti,
  moduli, `has_module_access`), 024b tutti attivi e Sonno nel piano Pro:
  robustezza verificata prima di applicarle (71957ab); applicate in produzione
  il 27/09.

### Documentazione (chiusura)
- `README.md` riscritto (pagine, API, migrazioni con stato), `CLAUDE.md` e
  questo changelog creati; `supabase/.temp/` tolto dal tracciamento e
  `.gitignore` esteso a `.env*`.

## 2026-09-25
- Sezione **"Accesso all'app"** nella scheda cliente: password temporanea,
  reset via email, registro accessi (9c8d2f9; migrazione 027).
- Il bottone **"Nuovo cliente"** crea davvero un cliente con lo stesso flusso
  dell'app (85778d9).

## 2026-09-16
- **Notifiche email al professionista** per le misurazioni da remoto: subito,
  riepilogo giornaliero o mai; Edge Function `notify-measurement` e
  `notify-digest`; migrazioni 025 e 026 (d978d7f).

## 2026-09-13
- **Gestione commerciale**: stato account, abbonamenti con scadenze, moduli
  per piano ed eccezioni, pannello Super Admin rivisto (07216c1; migrazione
  024).
- **Correzione dell'email** dell'account auth con anteprima, conferma e log
  (a7b7c7c).
- Collegamenti: 022 applicabile per singolo blocco, esclusioni 023 (1913ec4,
  4de1a97).

## 2026-09-11 / 12
- **Collegamenti cliente-professionista, flusso unico**: migrazioni 019–022,
  tab Salute collegamenti con Ripara e Unisci, Edge Function
  `create-client-access` v2, audit completo (`docs/COLLEGAMENTI_AUDIT.md`).
- Sessioni remote nel report periodico, nella colonna Stress e in "Vedi
  sessioni" (9aeabd8).

## Prima dell'11 settembre 2026
Monitoraggio 24h sul sito (018), organizzazioni (008), Super Admin (010–013,
017), Team Live (012), trigger demografico non sovrascrittivo (014), dashboard
con tachimetri, pagine legali e SEO, guide con assistente. Vedi la storia git.
