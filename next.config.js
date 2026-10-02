const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

module.exports = withNextIntl(nextConfig)
