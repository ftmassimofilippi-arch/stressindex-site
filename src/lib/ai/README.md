# Stress Index — Modulo AI Insights (Coming Soon)

Questa cartella è il punto di estensione futura per la generazione di insight clinici tramite Claude API.

## Architettura prevista

1. **Edge Function Supabase** (`/functions/v1/ai-insights`) viene invocata on-demand dalla dashboard o schedulata via pg_cron settimanalmente.
2. Riceve `client_id`, aggrega le ultime N sessioni dal DB, costruisce un prompt clinico strutturato.
3. Chiama `claude-opus-4-7` (con prompt caching abilitato sulle istruzioni di sistema).
4. Persiste `summary` e `recommendations` nella tabella `ai_insights`.
5. La UI in `app/area-professionisti/clienti/[id]` legge da `ai_insights` e mostra l'ultimo record con timestamp.

## File previsti

- `prompts.ts` — prompt clinici di sistema (con cache_control breakpoints)
- `client.ts` — wrapper Anthropic SDK
- `aggregator.ts` — funzioni di aggregazione dati cliente → payload modello
- `index.ts` — entrypoint pubblico

Per ora la UI mostra una card "Insights AI" disabilitata con badge "Coming soon".
