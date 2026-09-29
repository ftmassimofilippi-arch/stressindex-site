# i18n del sito: convenzioni

Il sito è in italiano (default, senza prefisso URL), inglese (`/en/...`) e
tedesco (`/de/...`) con **next-intl** e il segmento `src/app/[locale]/`. Gli
slug delle pagine restano italiani in tutte le lingue. Il glossario dei termini
di prodotto è in `docs/i18n-glossario.md`: **se un termine esiste nell'app, si
usa quello**.

## Dove stanno le cose

| Cosa | Dove |
|---|---|
| Routing, lingue, `splitLocale`/`withLocale` | `src/i18n/routing.ts` |
| `Link`, `useRouter`, `usePathname`, `redirect` consapevoli della lingua | `src/i18n/navigation.ts` |
| Caricamento messaggi (request config) | `src/i18n/request.ts`, `src/i18n/messages.ts` |
| Tipo `Tr` (funzione di traduzione "pura") | `src/i18n/types.ts` |
| Lingua e traduttore FUORI da React (route API, PDF, email) | `src/lib/i18n-server.ts` (`getRequestLocale`, `getTranslator`) |
| Metadata SEO con hreflang | `src/lib/seo.ts` (`pageMetadata`, `alternatesFor`) |
| Date e numeri per lingua | `src/lib/format.ts` (ogni funzione accetta `locale` finale) |
| Switcher IT / EN / DE | `src/components/LanguageSwitcher.tsx` |
| Messaggi | `messages/it.json`, `messages/en.json`, `messages/de.json` |
| Controllo chiavi e termini vietati | `node scripts/i18n-check.mjs` |

## Come si traduce, per contesto

**Client component** (`'use client'`):

```tsx
import { useTranslations, useLocale } from 'next-intl'
const t = useTranslations('dashboard.clients')
const locale = useLocale()
<h1>{t('title')}</h1>
<p>{t('count', { count: n })}</p>            // ICU: "{count, plural, one {# cliente} other {# clienti}}"
{t.rich('terms', { link: (c) => <Link href="/termini">{c}</Link> })}   // "Accetti i <link>Termini</link>"
```

**Server component async**:

```tsx
import { getTranslations, getLocale } from 'next-intl/server'
const t = await getTranslations('dashboard.home')
const locale = await getLocale()
```

**Metadata** di pagina (sostituisce `export const metadata`):

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo'
import type { Locale } from '@/i18n/routing'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return pageMetadata({ locale: params.locale as Locale, path: '/registrazione', title: t('registration.title'), description: t('registration.description') })
}
export default function Page({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale)   // pagine pubbliche: abilita il rendering statico
  ...
}
```

Per le pagine riservate (`index: false`) basta `title` + `robots` come oggi, ma
tradotto: `return { title: t('login.title'), robots: { index: false, follow: false } }`.

**Funzioni pure in `src/lib`** usate da client e server: non importano
`next-intl/server`. Ricevono un `t: Tr` (da `src/i18n/types.ts`) o una `locale`
come parametro, e le stringhe vivono nei file messaggi. Esempio:
`alertTypeLabel(type, t)` con `t = useTranslations('alerts')`.

**Route API** (PDF, CSV, email):

```ts
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'
const locale = await getRequestLocale(req)
const t = await getTranslator(locale, 'pdf.measurement')
```

**Navigazione**: `import { Link, useRouter, usePathname, redirect } from '@/i18n/navigation'`.
Mai `next/link`. `usePathname()` restituisce il percorso SENZA prefisso.
`window.location.href = '/x'` diventa `router.push('/x')` oppure
`withLocale('/x', locale)` da `@/i18n/routing`. `notFound`, `useSearchParams`,
`useParams` restano da `next/navigation`.

**Date e numeri**: `formatDate(d, undefined, locale)`, `formatMeasuredAt(row, locale)`,
`num(v, 1, locale)`, `pct(v, locale)`, `formatEur(49.9, locale)`, `todayLong(locale)`,
`formatGreeting(t)`. Per assi e tooltip Recharts: `new Intl.DateTimeFormat(intlTag(locale), ...)`
e `new Intl.NumberFormat(intlTag(locale), ...)`; `numRaw()` per chiavi, CSV e URL.

## File messaggi

Namespace di primo livello: `meta`, `common`, `home`, `features` (pagina
Funzionalità), `sportLanding`, `guide`, `support`, `registration`, `auth`,
`dashboard`, `clients`, `measurement`, `charts`, `scores`, `monitoring`,
`sport`, `admin`, `organization`, `settings`, `alerts`, `pdf`, `legal`,
`errors`, `emails`.

- Chiavi in camelCase, annidate per componente/sezione: `clients.table.emptyTitle`.
- Interpolazione ICU: `{name}`, plurali `{count, plural, one {...} other {...}}`,
  rich text con tag `<b>`, `<link>`.
- Le stesse tre chiavi devono esistere in it, en e de (`scripts/i18n-check.mjs`).
- Cosa NON si traduce: nomi di colonne del database e chiavi JSON, chiavi di
  `localStorage`, colori, sigle HRV (RMSSD, SDNN, pNN50, SD1/SD2, DFA α1,
  VLF/LF/HF, ms, ms², bpm), "Stress Index", "Polar H10", indirizzi email, URL.

## Lingua e stile

- Registro professionale B2B (fisioterapisti, preparatori, osteopati,
  professionisti del benessere). Tedesco con il "Sie". Inglese diretto, americano.
- Copy della landing: adattato, non tradotto parola per parola.
- **Linguaggio wellness, in tutte le lingue**: mai diagnosi/diagnosis/Diagnose,
  paziente/patient/Patient, clinico/clinical/klinisch, biomarcatore clinico,
  cartella clinica/medical record/Krankenakte, referto/medical report/Befund,
  terapia. Si usa cliente/client/Klient, valutazione/assessment/Bewertung,
  report, indicatore di benessere. "Adattamento" per
  `score_modulazione_infiammatoria`. Se il testo italiano di partenza usa un
  termine vietato, si corregge anche l'italiano.
- LF/HF non va presentato come indice di bilancio simpato-vagale: se lo trovi,
  segnalalo, non tradurlo in quella forma.
- Prezzi sempre in EUR: `formatEur` (49,90 € / €49.90 / 49,90 €).
- Nessun trattino lungo "—" nei testi italiani (virgola o due punti). Evitarlo
  anche in en/de.
- Il tedesco è più lungo: `truncate`, `min-w-0`, `whitespace-nowrap` con
  cautela, `flex-wrap` dove serve; i bottoni non devono rompersi su mobile.
