# Notifiche al professionista per le misurazioni da remoto

Quando un cliente collegato si misura dalla **propria** app, il professionista
riceve una email: subito, in un riepilogo giornaliero, oppure mai. Prima di
questo lavoro non arrivava niente.

Vale per tutte e tre le sorgenti:

| Tabella               | Evento          | Tipo nell'email                               |
| --------------------- | --------------- | --------------------------------------------- |
| `sessions`            | INSERT          | Misurazione standard / ortostatica / coerenza… |
| `monitoring_sessions` | INSERT          | Monitoraggio 24 ore / sonno / registrazione lunga |
| `night_metrics`       | INSERT          | Notte                                          |

**Solo le misurazioni da remoto.** Una riga conta come remota quando ha
`client_id IS NULL` e `professionista_id` che è un profilo con `role = 'client'`:
è il cliente che scrive a nome suo. Le misurazioni fatte in studio dal
professionista non generano nessuna email.

---

## 1. Migrazioni, nell'ordine

Da applicare a mano nel **SQL Editor** di Supabase, una alla volta.

| # | File | Note |
| - | ---- | ---- |
| 1 | `supabase-migrations/025_notifiche_misurazioni.sql` | Si applica così com'è. |
| 2 | `supabase-migrations/026_notifiche_cron.sql` | **Va modificata prima**: sostituisci `INCOLLA_QUI_IL_SEGRETO` con il valore di `NOTIFY_SECRET` (punto 2). Applicala **dopo** aver deployato `notify-digest`. |

Cosa fa la **025**:

- estende `notification_preferences` con `on_client_measurement`
  (`subito` | `riepilogo` | `mai`, default `riepilogo`), `digest_hour`
  (default 20), `email_override`, `timezone`, `lingua`;
- **rifà le policy RLS** di quella tabella. Quella della 001 era
  `FOR ALL USING (auth.uid() = user_id)` senza `WITH CHECK`: su `INSERT` la
  `USING` non viene valutata, quindi ogni salvataggio veniva rifiutato e la
  tabella è rimasta vuota. Da qui in poi la pagina Impostazioni salva davvero;
- crea `notification_queue` (coda degli eventi da comunicare) e
  `notification_log` (ogni invio riuscito, fallito o soppresso);
- crea gli helper `notifica_scheda_cliente()`, `notifica_destinatari()`,
  `notifiche_digest_da_inviare()`, `notifiche_pulizia()`, eseguibili **solo**
  dalla `service_role`;
- chiude con `notify pgrst, 'reload schema'`.

La **026** schedula due job pg_cron: `notifiche_riepilogo_orario` (ogni ora
a :05) e `notifiche_pulizia_giornaliera` (03:20 UTC).

---

## 2. Secret delle Edge Function

L'SMTP configurato in Supabase → Authentication serve **solo** alle email di
autenticazione e non è leggibile da una Edge Function: servono credenziali
proprie. Sono le stesse di allyou.srl.

```bash
supabase secrets set \
  --project-ref ivwmjwukpeldbqkxgvvf \
  SMTP_HOST='<host SMTP di allyou.srl>' \
  SMTP_PORT='587' \
  SMTP_USER='<utente SMTP di allyou.srl>' \
  SMTP_PASS='<password SMTP di allyou.srl>' \
  SMTP_FROM='Stress Index <notifiche@allyou.srl>' \
  SITE_URL='https://stressindex.io' \
  NOTIFY_SECRET="$(openssl rand -hex 32)"
```

- **`SMTP_PORT`** — `587` (STARTTLS, negoziato da solo) oppure `465` (TLS
  diretto). Sono gli unici due valori gestiti: con `465` la connessione parte
  già cifrata, con qualunque altra porta si tenta STARTTLS.
- **`SMTP_FROM`** — deve essere un indirizzo che quel server SMTP è autorizzato
  a usare, altrimenti la mail viene rifiutata o marcata spam. Controlla che il
  dominio del mittente abbia SPF e DKIM a posto.
- **`NOTIFY_SECRET`** — generato qui sopra. **Segnatelo**: serve identico nel
  webhook (punto 4) e nella migration 026. Non dà accesso a niente, dice solo
  "questa chiamata viene da noi": le due function sono deployate senza verifica
  del JWT perché né il webhook né `pg_net` portano un token utente.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` li inietta Supabase da solo, non
  vanno impostati.

Verifica: `supabase secrets list --project-ref ivwmjwukpeldbqkxgvvf`.

---

## 3. Deploy delle Edge Function

```bash
cd ~/progetti/stressindex-site

supabase functions deploy notify-measurement \
  --project-ref ivwmjwukpeldbqkxgvvf --no-verify-jwt

supabase functions deploy notify-digest \
  --project-ref ivwmjwukpeldbqkxgvvf --no-verify-jwt
```

`--no-verify-jwt` è necessario e non apre niente: l'accesso lo chiude
`NOTIFY_SECRET`, controllato in testa a ogni richiesta.

Entrambe importano `supabase/functions/_shared/`, che viene incluso da solo
perché è nel grafo degli import.

---

## 4. Database Webhook

### Dalla dashboard

Supabase → **Database → Webhooks → Create a new hook**, e ripeti **tre volte**,
una per tabella:

| Campo | Valore |
| ----- | ------ |
| Name | `notify_measurement_sessions` / `..._monitoring` / `..._night` |
| Table | `public.sessions` · `public.monitoring_sessions` · `public.night_metrics` |
| Events | **Insert** soltanto |
| Type | **Supabase Edge Functions** |
| Edge Function | `notify-measurement` |
| Method | `POST` |
| Timeout | `15000` ms |
| HTTP Headers | `x-notify-secret` = il valore di `NOTIFY_SECRET` |

### Oppure in SQL, che è la stessa cosa e si copia-incolla

Sostituisci `INCOLLA_QUI_IL_SEGRETO` e lancia nel SQL Editor:

```sql
do $$
declare
  v_url  text := 'https://ivwmjwukpeldbqkxgvvf.supabase.co/functions/v1/notify-measurement';
  v_hdr  text := '{"Content-Type":"application/json","x-notify-secret":"INCOLLA_QUI_IL_SEGRETO"}';
  v_tab  text;
begin
  foreach v_tab in array array['sessions', 'monitoring_sessions', 'night_metrics'] loop
    execute format('drop trigger if exists notify_measurement_%I on public.%I', v_tab, v_tab);
    execute format(
      'create trigger notify_measurement_%I after insert on public.%I
         for each row execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
      v_tab, v_tab, v_url, 'POST', v_hdr, '{}', '15000'
    );
  end loop;
end $$;
```

Il webhook è **at-least-once**: può arrivare due volte. La UNIQUE su
`notification_queue (source_table, source_id, professional_id)` e
l'anti-ripetizione rendono la doppia consegna innocua.

---

## 5. Come si comporta

```
INSERT su sessions / monitoring_sessions / night_metrics
      │
      ├─ non è remota (client_id valorizzato, o autore professionista) → stop
      │
      ▼
notifica_destinatari(cliente)  →  professionisti con link `active`
      │
      ├─ 'mai'       → stop, niente coda
      ├─ 'riepilogo' → riga in notification_queue, stop
      └─ 'subito'    → riga in coda, poi:
                        ├─ email già partita per questo cliente nell'ultima ora
                        │     → log 'skipped', l'evento RESTA in coda
                        └─ altrimenti → email con l'evento + tutti gli arretrati
                                        in coda per quel cliente, poi coda chiusa
```

L'anti-ripetizione non perde niente: un evento soppresso resta in coda e lo
raccoglie la prima email utile per quel cliente.

**Riepilogo giornaliero.** Ogni ora a :05 il cron chiama `notify-digest`, che
chiede a `notifiche_digest_da_inviare()` chi ha `digest_hour` uguale all'ora
corrente **nel proprio fuso** e ha almeno un evento in coda. Chi non ha niente
non compare, quindi non parte nessuna email vuota. L'email raggruppa per
cliente. Se l'invio fallisce la coda non si svuota e ci riprova il giorno dopo.

**Punteggi.** Per una sessione i punteggi stanno in `measurement_analytics`,
che l'app scrive con una chiamata separata subito dopo: il webhook può arrivare
prima. La function riprova una volta dopo 3 secondi; se ancora non ci sono,
l'email parte comunque e lo dice ("i punteggi compaiono tra poco nella scheda").

**Orari.** L'istante della misurazione segue la stessa convenzione di
`src/lib/format.ts`: con `tz_offset_minutes` il timestamp è già l'istante
giusto, senza è l'orologio da parete italiano scritto dentro un UTC. Le notti
non hanno un'ora vera e si mostrano come data sola.

---

## 6. Preferenze, per il professionista

**Area professionisti → Impostazioni → Notifiche**, sezione *Misurazioni dei
clienti collegati*: modalità, ora e fuso del riepilogo, lingua delle email
(IT/EN/DE), email alternativa. In fondo a ogni email c'è il link
`…/area-professionisti/impostazioni?tab=notifiche`, che apre direttamente
questa scheda.

Chi non ha mai toccato le impostazioni non ha una riga in
`notification_preferences`: valgono i default, cioè **riepilogo alle 20:00**,
fuso `Europe/Rome`, lingua italiana.

---

## 7. Testi delle email

Tutti in un unico file: **`supabase/functions/_shared/notify-strings.ts`**,
in italiano, inglese e tedesco. Registro wellness — si parla di *cliente*,
mai di paziente; niente diagnosi, niente valori patologici, niente consigli
medici. Per cambiare una frase si cambia lì e si ri-deploya.

---

## 8. Verifiche

```bash
# Le function rispondono e il segreto filtra davvero
curl -s -X POST https://ivwmjwukpeldbqkxgvvf.supabase.co/functions/v1/notify-digest \
  -H 'content-type: application/json' -d '{}'
# atteso: {"ok":false,"code":"forbidden"}

curl -s -X POST https://ivwmjwukpeldbqkxgvvf.supabase.co/functions/v1/notify-digest \
  -H 'content-type: application/json' -H "x-notify-secret: $NOTIFY_SECRET" -d '{}'
# atteso: {"ok":true,"inviati":0,...} fuori dall'ora di qualcuno
```

```sql
-- Chi verrebbe riepilogato adesso
select * from public.notifiche_digest_da_inviare();

-- Cosa è partito, e cosa no
select created_at, kind, status, reason, recipient_email, event_count
from public.notification_log order by created_at desc limit 50;

-- Cosa è ancora in attesa
select professional_id, count(*), min(occurred_at), max(occurred_at)
from public.notification_queue where sent_at is null group by 1;

-- Esito delle chiamate HTTP del webhook e del cron
select id, status_code, error_msg, created
from net._http_response order by created desc limit 20;

-- I job
select jobname, schedule, active from cron.job
where jobname like 'notifiche%';
```

I log delle due function stanno in Supabase → Edge Functions → *nome* → Logs.

---

## 9. Da sapere

- **La migration 024 non è applicata** (al 2026-09-16 `moduli` / `piani` /
  `abbonamenti` non esistono sul database). Le notifiche non dipendono dai
  moduli: un professionista riceve le email dei suoi clienti collegati anche
  senza il modulo Monitoraggio attivo, e il link lo porta su una pagina che poi
  gli mostra il modulo bloccato. Se in futuro si vuole filtrare, il punto è
  `notifica_destinatari()`.
- **`night_metrics` nasce da un monitoraggio** (`source_session_id`): una
  registrazione notturna remota produce due INSERT e quindi due potenziali
  notifiche. In modalità `subito` la seconda finisce nell'anti-ripetizione e
  viene accorpata; nel riepilogo compaiono entrambe le voci, che è corretto —
  sono due cose diverse.
- **STARTTLS.** Se il server SMTP di allyou.srl non lo supporta sulla 587,
  l'invio fallisce e il motivo finisce in `notification_log.reason`. In quel
  caso si passa a `SMTP_PORT=465`.
