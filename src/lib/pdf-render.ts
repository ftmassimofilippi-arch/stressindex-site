import { existsSync } from 'node:fs'
import type { Browser } from 'puppeteer-core'

// =============================================================================
// PDF da una pagina di stampa del sito con Chrome headless.
// =============================================================================
//
// Su Vercel: puppeteer-core + @sparticuz/chromium (binario Chromium compresso
// nel bundle della function, runtime nodejs). In locale: il Chrome installato
// (CHROME_PATH oppure i percorsi standard di macOS/Linux).
//
// La pagina di stampa espone `window.__REPORT_READY__ = true` quando font e
// grafici sono pronti (componente PrintReady): si stampa solo dopo.

const LOCAL_CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter((p): p is string => !!p)

function isServerless(): boolean {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV)
}

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import('puppeteer-core')
  if (isServerless()) {
    const chromium = (await import('@sparticuz/chromium')).default
    return puppeteer.launch({
      args: [...chromium.args, '--font-render-hinting=none'],
      defaultViewport: { width: 1000, height: 1400, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
  const executablePath = LOCAL_CHROME_CANDIDATES.find((p) => existsSync(p))
  if (!executablePath) {
    throw new Error('Chrome non trovato: imposta CHROME_PATH (percorso dell\'eseguibile di Chrome/Chromium).')
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    defaultViewport: { width: 1000, height: 1400, deviceScaleFactor: 1 },
  })
}

export type RenderPdfOptions = {
  /** URL assoluta della pagina di stampa. */
  url: string
  /** Header Cookie della richiesta originale: la pagina gira con la sessione del professionista. */
  cookieHeader?: string | null
  /** Timeout complessivo (ms). */
  timeoutMs?: number
}

export async function renderPagePdf({ url, cookieHeader, timeoutMs = 45_000 }: RenderPdfOptions): Promise<Buffer> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(timeoutMs)
    if (cookieHeader) {
      // I cookie viaggiano con la prima richiesta e con quelle successive
      // (font, chunk JS): l'header extra vale per tutto il documento.
      await page.setExtraHTTPHeaders({ cookie: cookieHeader })
    }
    await page.emulateMediaType('print')
    const res = await page.goto(url, { waitUntil: 'networkidle0', timeout: timeoutMs })
    if (!res || !res.ok()) {
      throw new Error(`pagina di stampa non disponibile (${res?.status() ?? 'nessuna risposta'})`)
    }
    await page.waitForFunction('window.__REPORT_READY__ === true', { timeout: timeoutMs })
    // Un frame in più: i grafici SVG hanno appena finito di posizionare le etichette.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      // Header e footer stanno nel CSS della pagina; qui solo il numero di
      // pagina "x / y", che il CSS di Chrome non sa contare.
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:8px;color:#8A94A0;text-align:right;padding:0 14mm 4mm 0;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close().catch(() => undefined)
  }
}

/** Origine del sito per aprire le pagine di stampa: la richiesta stessa, oppure NEXT_PUBLIC_SITE_URL. */
export function siteOrigin(req: Request): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https')
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stressindex.io'
}

export function pdfLegacyEnabled(): boolean {
  return process.env.PDF_LEGACY === 'true'
}

export function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}
