# Reset password e invito: come funziona e cosa configurare su Supabase

> **Aggiornamento 15/10/2026 (audit QA, punto D6).** I link email ora passano
> da **`/auth/confirm`** con `token_hash`: il token si consuma solo quando
> l'utente preme il pulsante, non al semplice GET. Motivo: il log Auth del
> 14/10 alle 09:01 mostra `403 Email link is invalid or has expired, One-time
> token not found` con referer stressindex.io e IP 74.125.19.33 (Google): il
> prescanner di Gmail apriva il link prima dell'utente e bruciava il token.
> Esiste anche **`/auth/callback`** per i link PKCE (`?code=`): scambio lato
> server e redirect a `/imposta-password`.
>
> **Da fare nel dashboard Supabase (Authentication):**
> 1. *URL Configuration* → Site URL `https://stressindex.io`, Redirect URLs:
>    `https://stressindex.io/**`, `https://www.stressindex.io/**`,
>    `http://localhost:3000/**`, `stresstest://**`.
> 2. *Email Templates* → per **Reset password**, **Invite user**, **Confirm
>    signup**, **Magic link** sostituire `{{ .ConfirmationURL }}` con
>    `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
>    (rispettivamente `invite`, `signup`, `magiclink`). I template pronti
>    sono in `docs/email-templates/*.html`, già aggiornati.
> 3. *Providers → Email* (o *Settings → Security*, secondo la versione del
>    dashboard) → **"Prevent the use of leaked passwords"** (HaveIBeenPwned):
>    attivare. Richiede il piano Pro. Il sito mostra già un messaggio dedicato
>    (`errors.supabase.leakedPassword`) quando Supabase rifiuta una password
>    compromessa (punto D4).
>
> Il flusso vecchio (`{{ .ConfirmationURL }}` → verify di Supabase →
> `/imposta-password` con `#access_token` o `?code`) resta funzionante per le
> email già inviate: `/imposta-password` gestisce tutti i formati e
> `RecoveryLinkRedirect` inoltra i `token_hash` atterrati altrove a
> `/auth/confirm`.


## Il problema (pagina bianca)

Il link nell'email arriva correttamente ma apre una pagina bianca. Verificato
sul progetto reale generando un link di recovery con la Admin API:

```
action_link:  https://<project>.supabase.co/auth/v1/verify?token=<TOKEN>&type=recovery
              &redirect_to=stresstest://reset-password
verify → 303  Location: stresstest://reset-password#access_token=…&refresh_token=…&type=recovery
```

Due fatti importanti:

1. **La Site URL del progetto Supabase è `stresstest://reset-password`**, cioè il
   deep link dell'app Flutter. In un browser desktop quello schema non è
   gestito da nessuna applicazione → **pagina bianca**.
2. **Il `redirectTo` chiesto dal sito viene ignorato.** Provato con
   `https://stressindex.io/area-professionisti/recupera-password`,
   `https://stressindex.io/imposta-password` e senza redirect: GoTrue restituisce
   sempre `redirect_to=stresstest://reset-password`, perché quegli URL **non
   sono nella allowlist** (Redirect URLs) e in quel caso GoTrue ricade sulla
   Site URL. Vale identicamente per il link di invito.

Quindi il bug non è (solo) nel sito: finché la configurazione Supabase resta
questa, **nessuna** pagina web può ricevere il token.

## Cosa fare su Supabase (Authentication → URL Configuration)

1. **Site URL**: `https://stressindex.io/imposta-password`
   È il fallback usato quando il chiamante non passa un `redirectTo` valido —
   incluse le email inviate dall'app Flutter, che così atterrano su una pagina
   web funzionante invece che su una pagina bianca.
2. **Redirect URLs** (allowlist, una per riga):
   ```
   https://stressindex.io/**
   http://localhost:3000/**
   stresstest://reset-password
   stresstest://**
   ```
   - le prime due fanno rispettare il `redirectTo` chiesto dal sito
     (`/imposta-password`), in produzione e in sviluppo;
   - le ultime due mantengono funzionante il deep link dell'app Flutter, se
     l'app passa esplicitamente `redirectTo: 'stresstest://reset-password'`.

> Se l'app Flutter **non** passa `redirectTo` esplicito, dopo la modifica i suoi
> link di reset porteranno alla pagina web `/imposta-password`: funziona
> ugualmente (l'utente imposta la password nel browser e poi accede dall'app).
> Per farli tornare nell'app basta aggiungere `redirectTo` esplicito lato app.

## Cosa fa il sito

`/imposta-password` (`src/app/imposta-password/`) è la pagina di atterraggio.
È volutamente **fuori** da `/area-professionisti`: il middleware di quell'area
rimanda al login chi non ha sessione e alla dashboard chi ce l'ha, e in
entrambi i casi il flusso di recovery si romperebbe.

Gestisce tutti i formati con cui Supabase può consegnare il token:

| Formato | URL | Gestione |
|---|---|---|
| implicit flow | `#access_token=…&refresh_token=…&type=recovery\|invite` | `setSession` |
| PKCE | `?code=…` | `exchangeCodeForSession` |
| token hash | `?token_hash=…&type=recovery` | `verifyOtp` |
| già consumato da `detectSessionInUrl` | — | `getSession` |
| errore | `#error=access_denied&error_code=otp_expired&…` | messaggio dedicato |

Distingue **recovery** e **invite** (`type=invite` / `type=signup`) cambiando
testi e call to action, e non mostra mai una pagina bianca: o il form, o un
messaggio d'errore esplicito (link scaduto / già usato / token mancante) con il
pulsante per richiederne uno nuovo. Dopo il salvataggio l'URL viene ripulito dai
token con `history.replaceState`.

`/area-professionisti/login` e `/area-professionisti/recupera-password` montano
`RecoveryLinkRedirect`, che inoltra a `/imposta-password` un eventuale token
atterrato lì (email già inviate, o Site URL puntata su quelle pagine).

## Dove viene chiesto il redirect

| Punto | File | `redirectTo` |
|---|---|---|
| Form "password dimenticata" | `src/app/area-professionisti/recupera-password/RecoverForm.tsx` | `${origin}/imposta-password` |
| Pannello Super Admin → "Invia reset" | `src/app/api/admin/users/[id]/password/route.ts` | `${NEXT_PUBLIC_SITE_URL}/imposta-password` |

## Verifica dopo la modifica della configurazione

```bash
# genera un link senza inviare email e mostra dove porta davvero
node -e '…'  # oppure: Admin API generateLink({ type: "recovery", email })
```
Atteso: `redirect_to=https://stressindex.io/imposta-password` e, seguendo il
`verify`, un `Location` verso `https://stressindex.io/imposta-password#access_token=…`.
