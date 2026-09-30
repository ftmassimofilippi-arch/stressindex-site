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
}

module.exports = withNextIntl(nextConfig)
