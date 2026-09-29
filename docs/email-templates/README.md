# Template email Supabase Auth in IT / EN / DE

Supabase non supporta template per lingua. Ogni template qui sotto contiene i
tre testi e sceglie quello giusto con un blocco condizionale Go template sulla
lingua salvata nei metadata dell'utente (`user_metadata.locale`, scritta dal
form di registrazione del sito):

```
{{ if eq .Data.locale "en" }} ... {{ else if eq .Data.locale "de" }} ... {{ else }} ... {{ end }}
```

Senza `locale` (utenti registrati dall'app o prima di questa modifica) si
mostra l'italiano.

## Come applicarli

Dashboard Supabase → Authentication → Email Templates. Per ognuno incollare
l'oggetto e il corpo:

| Template Supabase | File | Oggetto (Subject) |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `{{ if eq .Data.locale "en" }}Confirm your Stress Index account{{ else if eq .Data.locale "de" }}Bestätigen Sie Ihr Stress Index Konto{{ else }}Conferma il tuo account Stress Index{{ end }}` |
| Reset password | `reset-password.html` | `{{ if eq .Data.locale "en" }}Reset your Stress Index password{{ else if eq .Data.locale "de" }}Stress Index Passwort zurücksetzen{{ else }}Reimposta la password di Stress Index{{ end }}` |
| Magic link | `magic-link.html` | `{{ if eq .Data.locale "en" }}Your Stress Index sign-in link{{ else if eq .Data.locale "de" }}Ihr Anmeldelink für Stress Index{{ else }}Il tuo link di accesso a Stress Index{{ end }}` |
| Invite user | `invite.html` | `{{ if eq .Data.locale "en" }}You have been invited to Stress Index{{ else if eq .Data.locale "de" }}Sie wurden zu Stress Index eingeladen{{ else }}Sei stato invitato su Stress Index{{ end }}` |

Il campo Subject della dashboard accetta le stesse espressioni Go template del
corpo.

## Variabili usate

- `{{ .ConfirmationURL }}`: link firmato da Supabase (conferma, reset, magic link, invito).
- `{{ .SiteURL }}`: Site URL del progetto (deve restare `https://stressindex.io/imposta-password`, vedi `docs/reset-password.md`).
- `{{ .Data.locale }}`: lingua dell'utente (`it`, `en`, `de`).

Il `redirectTo` chiesto dal sito porta già alla pagina `/imposta-password`
nella lingua dell'utente (`/en/imposta-password`, `/de/imposta-password`):
la allowlist Redirect URLs deve contenere `https://stressindex.io/**`.

La configurazione SMTP (allyou.srl, `noreply@stressindex.io`) non cambia.
