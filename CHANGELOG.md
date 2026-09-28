# Changelog — Stress Index, sito e dashboard

Voci ricavate dalla storia git. Le migrazioni si applicano a mano; lo stato in
produzione è nel `README.md`.

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
