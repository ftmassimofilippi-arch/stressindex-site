const { execSync } = require('node:child_process')
const createNextIntlPlugin = require('next-intl/plugin')
const { withSentryConfig } = require('@sentry/nextjs/config')

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// Release di Sentry = commit. Su Vercel lo dà la piattaforma; in locale si
// chiede a git, e se non c'è nemmeno quello la release resta non dichiarata.
function commitSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return undefined
  }
}
const SENTRY_RELEASE = commitSha()

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Fissate alla build, uguali per browser e server (`src/lib/sentry-options.ts`).
  // La DSN non è qui: è la variabile `NEXT_PUBLIC_SENTRY_DSN` su Vercel.
  env: {
    NEXT_PUBLIC_SENTRY_RELEASE: SENTRY_RELEASE ?? '',
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.VERCEL_ENV ?? 'development',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Image Optimization SPENTA — mitigazione di GHSA-2xp9-vwfh-vxw4
  // ───────────────────────────────────────────────────────────────────────────
  // L'advisory critical di next <15.5.24 è una RCE nell'endpoint `/_next/image`
  // (decodifica AVIF). La linea 14.x non ha una patch: 14.2.35 è l'ultima.
  // Il sito non usa `next/image` (solo <img> e `next/og`), quindi l'endpoint
  // non serve a niente: con `unoptimized` risponde 404 e la superficie sparisce.
  // Da NON togliere finché `next` non è almeno 15.5.24; se un giorno si vuole
  // `next/image`, prima l'aggiornamento.
  images: { unoptimized: true },
  experimental: {
    // Chrome headless per i PDF: i pacchetti restano esterni al bundle e il
    // binario Chromium (bin/*.br) viene incluso nella function delle route /api/pdf.
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
    outputFileTracingIncludes: {
      '/api/pdf/**': ['./node_modules/@sparticuz/chromium/bin/**'],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Canonico su www — PER LE PAGINE, NON PER /api
  // ───────────────────────────────────────────────────────────────────────────
  //
  // ⚠️ QUESTO REDIRECT NON PUÒ TORNARE A LIVELLO DI DOMINIO, e non è una
  // preferenza di stile. Il redirect di dominio Vercel («stressindex.io →
  // www.stressindex.io») non sa escludere un percorso: risponde 307 a
  // *qualsiasi* richiesta sull'apice, /api comprese. E su un redirect verso un
  // host diverso `package:http` di Dart **non riporta l'header
  // `Authorization`** (verificato: l'origine lo riceve, la destinazione lo
  // vede `null`).
  //
  // L'app Flutter chiama `https://stressindex.io/api/clienti/<id>/accesso`
  // (`lib/config/site_config.dart`) con `Authorization: Bearer <access token>`.
  // Con il redirect di dominio la richiesta arrivava su www **senza** header:
  // `requireProfessional` non trovava né Bearer né cookie, `getUser()` tornava
  // null senza nemmeno interpellare Supabase, e la route rispondeva
  // `401 {"error":"unauthorized"}`. L'app traduce quel codice in «Sessione
  // scaduta: esci e rientra, poi riprova» — un messaggio che nessun logout può
  // risolvere, perché il token non era mai stato in discussione. La card
  // "Accesso all'app" non ha quindi MAI funzionato dall'app dal 27/09, mentre
  // dal sito funzionava: lì il cookie c'è.
  //
  // Le pagine restano canoniche su www (cookie di sessione, SEO): si
  // reindirizza tutto tranne /api, che sull'apice va servito e basta.
  // `permanent: false` → 307, il metodo e il corpo non cambiano.
  async redirects() {
    return [
      {
        source: '/:resto((?!api/|api$).*)',
        has: [{ type: 'host', value: 'stressindex\\.io' }],
        destination: 'https://www.stressindex.io/:resto',
        permanent: false,
      },
    ]
  },
}

module.exports = withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  telemetry: false,
  release: { name: SENTRY_RELEASE },
  // Le source map si caricano solo se su Vercel ci sono SENTRY_AUTH_TOKEN,
  // SENTRY_ORG e SENTRY_PROJECT; senza, la build passa e gli stack del browser
  // restano minificati.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
})
