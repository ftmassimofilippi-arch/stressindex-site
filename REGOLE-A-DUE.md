# Regole per lavorare in due sullo stesso codice (Matteo e Massimo)

Questo file lo legge l'AI all'inizio di ogni sessione, in qualunque strumento (Claude Code,
Codex, Cursor). Vale per tutti e sei i programmi: CRM Calderone, Vivi, Bifrost, BioIndex,
l'app Stress Index e il sito Stress Index. Il CRM è il collante: il suo database è la
fondazione di tutto il resto.

## Chi fa cosa

- **Massimo** è il titolare. Decide cosa deve fare il sistema, lavora con la sua AI sui rami
  suoi, e propone le modifiche. Ha accesso a tutte le credenziali e a tutti i dati.
- **Matteo** costruisce, rivede le proposte, scrive le migrazioni del database e pubblica.
- **Nessuno pubblica in produzione da solo.** Quello che va online passa sempre da una
  proposta (pull request) letta dall'altro.

## Le sei regole ferree (non si negoziano, non si "ottimizzano")

1. **Mai lavorare sul ramo principale `main`.** Prima di toccare un file si crea un ramo dal
   `main` aggiornato, col nome `<nome>/<cosa-si-fa>` (esempio `massimo/grafico-hrv`):
   `git fetch origin && git switch -c massimo/<cosa> origin/main`.
   Se la sessione parte già su `main`, la prima cosa da fare è creare il ramo.
2. **Il diario è obbligatorio.** Ogni richiesta scritta all'AI finisce in `diario/`, con data,
   ora, ramo e autore. In Claude Code lo fa un automatismo da solo. Con altri strumenti l'AI
   **copia la richiesta parola per parola** nel file del giorno (`diario/AAAA-MM-GG-<autore>.md`)
   prima di toccare codice. Il diario si committa insieme al lavoro: è così che chi ripara un
   difetto capisce qual era l'obiettivo.
3. **Le migrazioni del database non si applicano da un ramo di lavoro.** Nel CRM e in Vivi
   (`src/db/migrazioni/`) non si aggiungono, non si modificano, non si applicano: le scrive
   Matteo. Qui, dove il database è di Massimo, la migrazione si scrive nella proposta e si
   applica **solo a mano, dopo che la proposta è stata letta** — mai dall'AI, mai in automatico.
4. **I segreti non si toccano e non si stampano.** I file `.env*` non si modificano, non si
   leggono ad alta voce, non si committano. Una chiave scritta in chat è bruciata e va rifatta.
5. **A fine lavoro, i controlli verdi e poi la proposta.** In ordine: `npm run typecheck` e
   `npm run lint`. Poi si committano **solo i propri file** (`git commit -- <file…>`, mai
   `git commit -a`), si fa `git push -u origin <ramo>` e si apre la proposta con
   `gh pr create --fill` compilando il modulo che compare. Poi ci si ferma: unisce chi rivede.
6. **Mai dati veri nei file e nei test.** Nomi, email, telefoni e misurazioni nei test sono
   inventati. Mai invii reali (WhatsApp, email, SMS, notifiche) da un ramo di lavoro.

## Il guardiano

Le regole qui sopra non sono affidate alla memoria: un **guardiano** committato nel repository
(`.claude/hooks/guardiano.mjs`, agganciato a Claude Code prima di ogni comando) ferma i gesti
pericolosi prima che partano e spiega il perché: push su `main`, push forzato, `git commit -a`,
lettura o scrittura dei file `.env`, migrazioni applicate, `gh pr merge`, pubblicazioni sul
server. Un secondo guardiano (`.githooks/pre-push`, installato con `bash .githooks/installa.sh`
una volta per clone) rifiuta il push su `main` da qualunque strumento. Se il guardiano blocca un
comando, **non si cerca il modo di aggirarlo**: si scrive nella proposta cosa serviva.

## Cose che non si fanno mai

- `git push --force`, cancellare rami di altri, riscrivere la storia di `main`.
- Cambiare i file di configurazione dei controlli o i workflow in `.github/` senza dirlo
  nella proposta.
- Toccare più di una cosa per proposta. Una proposta = un obiettivo. Se ne emerge un altro, si
  scrive una scheda nuova (issue) e si va avanti.
- Inventare un dato mancante. Se manca, si dice che manca.

## Come si scrive una richiesta (scheda)

Su GitHub, "Issues" → "New issue" → modulo "Richiesta". Tre righe, in parole proprie:
cosa voglio ottenere, perché, come riconosco che è fatto. **Mai la soluzione tecnica**: quella la
trova chi costruisce. Ogni proposta cita la sua scheda (`Chiude #12`).

## Cosa fa l'AI all'inizio di ogni sessione

1. Legge questo file.
2. Controlla il ramo: se è `main`, crea il ramo di lavoro prima di qualunque modifica.
3. Se la richiesta non è già nel diario (altri strumenti), la copia lì.
4. Lavora **solo dentro il perimetro della richiesta**.
5. Chiude con i controlli verdi, il commit dei propri file, il push e la proposta.

## Dove sono le cose

| Programma            | Repository          | Cartella app              | Controlli da passare prima della proposta |
| -------------------- | ------------------- | ------------------------- | ----------------------------------------- |
| CRM Calderone        | `calderone-crm`     | radice                    | `npm run typecheck`, `npm run lint`, `npm test` |
| Vivi                 | `piattaforma-vivi`  | radice                    | `npm run typecheck`, `npm run lint`, `npm test` |
| Bifrost              | `bifrost`           | `web/`                    | `cd web && npm run typecheck && npm run lint` |
| BioIndex             | `bioindex`          | `frontend/`, `backend/`   | `cd frontend && npm run typecheck && npm run lint` |
| Stress Index (app)   | `stress-test`       | radice (Flutter)          | `flutter analyze`, `flutter test`         |
| Stress Index (sito)  | `stressindex-site`  | radice (Next.js)          | `npm run typecheck`, `npm run lint`       |

## Se qualcosa non torna

Non si forza. Si scrive nel diario cosa si è visto, si apre la proposta anche a metà con il
titolo che inizia per `[bloccato]`, e si dice all'altro cosa manca.
