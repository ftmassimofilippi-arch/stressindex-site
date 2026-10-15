# Report delle correzioni, audit QA del 14 ottobre 2026

Lavoro del 15/10/2026. Analisi in `docs/ANALISI_QA_2026-10-14.md`, correzioni che
spettano all'app in `docs/FIX_APP_DA_FARE.md`. Commit su `main`, tutti in
produzione su Vercel: `8fcee9c` (analisi), `8a810b4` (A), `8806b01` (B e
migrazioni), `60020e2` (C, D, F), `d58aa60` (E, F2), più il commit di questo report.

**Premessa.** La produzione era ferma al 4/10: i 15 commit del 7/10 sul
perimetro del professionista stavano solo sul ramo `fix/perimetro-home`. Su tua
indicazione il ramo è stato unito in `main` prima di tutto il resto. Parte di
C1 e C3 veniva da lì.

**Scostamenti dal prompt, decisi con te o imposti dal repo.**
- Migrazioni in `supabase-migrations/sito-NNN_*.sql` (regola di `CLAUDE.md`),
  non in `supabase/migrations/YYYYMMDDHHMM_*`.
- C, D e F in un solo commit: condividono `dashboard-data.ts`, layout e file
  messaggi, separarli lasciava commit che non compilano.
- C3: in "Tutta la piattaforma" solo conteggi, nessuna riga dei clienti altrui
  (tua scelta del 15/10, coerente con il blocco del 7/10 sul consenso).

## Stato punto per punto

| Punto | Stato | Note e file principali |
|---|---|---|
| A1 | fatto | `/termini`, `/cookie` con sezioni `[DA COMPLETARE CON IL LEGALE]`; `/contatti` → `/supporto` (308); sitemap |
| A2 | parziale | un solo titolare in `src/config/company.ts` e `LegalFooter`; **indirizzo e P.IVA di The Performance Lab `[DA COMPLETARE]`**, compaiono così nel footer |
| A3 | fatto | `Header`/`Footer` unici anche in home, `HomeNavbar` eliminata |
| A4 | fatto | `src/config/pricing.ts`: Base 69,90, Founding 49,90 (200 posti), Pro 99 |
| A5 | fatto | "Nessuna carta richiesta" ovunque |
| A6 | fatto | 5 score, 25+ parametri; "tre tipi di test più la sessione lunga" |
| A7 | fatto | via Insights AI, etichetta logo, roadmap sport "cosa c'è / cosa arriva" |
| A8 | fatto lato sito | frase ricomposta da `alertMessage`; soluzione pulita nell'app (G-A8 in FIX_APP) |
| A9 | fatto | 404 con titolo proprio e noindex; "Oggi \| Area Professionisti Stress Index" |
| A10 | fatto | mese minuscolo, "DS", α1 non maiuscolo, "Esaurimento", assistente: la chat delle guide esiste, frase lasciata |
| B1 | fatto | `trend-period.ts` testato (Doretta: 7g 0, 90g 1, Tutto 2), zoom azzerato, didascalia |
| B2 | fatto | linee media/mediana, toggle, riga riassuntiva con segni e colori, "Dati insufficienti" |
| B3 | fatto | causa vera: `GaugeScore` (trigonometria diversa fra Node e browser); console a 0 |
| B4 | fatto | default "tutto" sotto 50 misurazioni, avviso "Stai vedendo X di Y" |
| B5 | fatto | colonna Apri fissa a destra |
| C1 | fatto | Analytics: 65 misurazioni, 31 clienti attivi nel periodo; errori visibili |
| C2 | fatto | elenco, selettore, niente doppio invio; organizzazioni doppie unite (sito-043) |
| C3 | fatto | `getDataScope()` con test, interruttore, cookie, badge VISTA GLOBALE |
| C4 | fatto | "Oggi" = giorno italiano |
| C5 | fatto | sito-035: 0 schede disallineate su 801; trigger anche su DELETE/UPDATE |
| C6 | fatto | sito-036/037: dedup per misurazione, 821 doppioni marcati, auto risoluzione (240 al primo giro), "×N" in UI |
| C7 | fatto | "Energia: 12,6" invece di "valore 12,64" |
| C8 | fatto | alert attivi = new+seen ovunque; "Clienti totali" con attivi a 90 giorni; "Vedi tutte" |
| C9 | fatto, da decidere | pannello da `abbonamenti`; **"In prova" = 0**: i 12 trial veri sono registrati `base`; **145 Pro senza scadenza**: voluti? |
| C10 | fatto | tab "Possibili duplicati" (47 gruppi, 31 fra professionisti diversi) e "Senza scheda" (54 da account professionista in 30 giorni) |
| C11 | fatto | menu solo con clienti che hanno monitoraggi |
| D1 | fatto | sito-038: 0 funzioni SECURITY DEFINER eseguibili da `anon` |
| D2 | fatto | sito-039; restano senza policy solo i `*_backup_*`/`*_orfane_*` (elenco sotto) |
| D3 | fatto | sito-040: 0 funzioni senza `search_path` |
| D4 | da fare tu | dashboard Supabase, vedi sotto; il sito mostra già il messaggio dedicato |
| D5 | fatto | `method="post"` |
| D6 | fatto lato sito, da fare tu nel dashboard | `/auth/confirm` (token al clic, verificato) e `/auth/callback`; template email da incollare |
| D7 | fatto | refresh token non valido: cookie `sb-*` cancellati e login, verificato |
| E1 | fatto | lista clienti 94 KB trasferiti, interattiva ~1 s (build locale) |
| E2 | parziale | Oggi 135 KB, Analytics da 309 a 135 KB; niente RPC o viste materializzate (non servono ai volumi di oggi) |
| E3 | fatto | `prefetch={false}` sui link all'area |
| E4 | fatto | middleware senza RPC né tabelle, stato account nel layout |
| E5 | fatto | sito-041, quattro indici |
| F1 | fatto | sito-044 `unaccent` + `clients.ricerca`; parole in qualsiasi ordine, lista e header |
| F2 | fatto | card sotto 640 px; a 390 px nessun elemento fuori schermo (verificato) |
| F3 | fatto | briciole con nome cliente e data |
| F4 | fatto | "n.d." con motivo; SDNN Index non è mai calcolato dall'app |
| F5 | fatto | sensore leggibile o "Sensore BLE" |
| F6 | parziale | score interi in tabelle e card principali; un decimale resta nelle card dedicate |
| F7 | fatto | sessioni < 5 min fuori dalle statistiche, badge "Troppo breve" |
| F8 | fatto | range da `hrv_norms` per età e sesso; avviso se mancano (Doretta) |
| F9 | fatto | Title Case in visualizzazione |
| G1 | mitigato | sito-042 (provata), correzione nell'app in FIX_APP |
| G2 | rimandato all'app | la FK deferibile non serve con PostgREST: ordine di invio nell'app |
| G3 | documentato | picchi di "Thread killed" alle 04-06 e 10-16 UTC, orari di sincronizzazione dell'app, non legati alle pagine del sito |

## Migrazioni

Tutte applicate in produzione il 15/10, con la verifica scritta in fondo a ogni
file: sito-035, 036, 037 (estesa ai "misurazione mancata" su tua indicazione),
038, 039, 040, 041, 042, 043 (estesa a ogni owner su tua indicazione: unite anche
le due organizzazioni doppie di Maria Grazia Berardinelli), 044, 045 (RLS sulle
tre tabelle di log create oggi: le avevo lasciate esposte, segnalate
dall'advisor e chiuse). **Nessuna migrazione in attesa.**

## Da fare tu (dashboard Supabase, Authentication)

1. **Leaked password protection**: *Authentication → Providers → Email* (o
   *Settings → Security*): "Prevent the use of leaked passwords". Richiede il
   piano Pro.
2. **URL Configuration**: Site URL `https://stressindex.io`; Redirect URLs
   `https://stressindex.io/**`, `https://www.stressindex.io/**`,
   `http://localhost:3000/**`, `stresstest://**`.
3. **Email Templates** (Reset password, Invite, Confirm signup, Magic link):
   incollare i file di `docs/email-templates/`, che puntano a
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...`. Finché
   non lo fai i link continuano a funzionare come prima, ma i prescanner di
   Gmail possono ancora bruciarli.

## Decisioni aperte

- Indirizzo e P.IVA di The Performance Lab S.r.l. (`src/config/company.ts`) e
  revisione legale di Termini e Cookie.
- I 12 trial ancora attivi registrati come `base`: convertirli in `prova`?
- I 145 Pro senza scadenza: voluti?
- Tabelle senza policy candidate alla rimozione (dopo tuo ok):
  `_backup_laura_20261001_analytics`, `_backup_laura_20261001_sessions`,
  `client_professional_links_backup_20260913`, `clients_backup_20260913`,
  `measurement_analytics_backup_20260620`,
  `measurement_analytics_link_backup_20260913`,
  `measurement_analytics_orfane_20260914`,
  `measurement_analytics_orfane_20260929`,
  `measurement_analytics_utc_backup_20260930`, `sessions_link_backup_20260913`.
- **Non mie, advisor ERROR**: cinque tabelle `backup_laura_20261015_*` e
  `backup_marco_morbin_20261015_*` create oggi da un'altra sessione, senza RLS.
  Le deve chiudere chi le ha create (o le chiudo io se mi dai l'ok).
- Doretta ha 1 alert attivo, non 2: il secondo era un doppione ed è `duplicate`.

## Verifica in 5 minuti

1. `stressindex.io/termini`, `/cookie`, `/en/termini`, `/de/cookie` aprono;
   `/contatti` porta a Supporto; footer uguale in home e interne, The
   Performance Lab.
2. Home e `/sport`: Base 69,90, Founding 49,90, Pro 99, "Nessuna carta".
3. Scheda Doretta, Panoramica: "Tutto" = "2 misurazioni", linee media e
   mediana; "90 giorni" = 1 misurazione e "Dati insufficienti".
4. Analytics: Misurazioni e Clienti attivi sopra zero.
5. Organizzazione: "Codice Massimo", nessun form di creazione.
6. Clienti, filtro Oggi; cerca "sabbatini doretta" e "nicolo".
7. In alto "Tutta la piattaforma": badge rosso e conteggi, nessun nome; torna
   a "I miei dati".
8. Telefono: home e Clienti a card, niente scorrimento orizzontale.
