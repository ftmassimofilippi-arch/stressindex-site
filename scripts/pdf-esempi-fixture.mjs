// Genera i PDF delle pagine di stampa con DATI DI SIMULAZIONE (nessun accesso
// al database) in it/en/de, salvandoli in docs/pdf-esempi/.
// Uso: con `npm run dev` attivo, `BASE=http://localhost:3000 node scripts/pdf-esempi-fixture.mjs [filtro]`.
import puppeteer from 'puppeteer-core'
import { writeFileSync, mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:3778'
const jobs = []
for (const kind of ['standard', 'orthostatic', 'coherence', 'long']) {
  for (const locale of ['it', 'en', 'de']) {
    const prefix = locale === 'it' ? '' : `/${locale}`
    jobs.push({ name: `misurazione-${kind}-${locale}`, url: `${base}${prefix}/stampa/misurazione/fixture?fixture=${kind}` })
  }
}
for (const locale of ['it', 'en', 'de']) {
  const prefix = locale === 'it' ? '' : `/${locale}`
  jobs.push({ name: `report-periodico-${locale}`, url: `${base}${prefix}/stampa/report-periodico?fixture=report&from=2026-08-31&to=2026-09-30` })
}
// Monitoraggio 24h e Sonno (dati simulati di src/lib/print-fixtures-monitoring.ts), versione professionista e cliente.
for (const kind of ['sleep', '24h']) {
  for (const variant of ['pro', 'client']) {
    for (const locale of ['it', 'en', 'de']) {
      const prefix = locale === 'it' ? '' : `/${locale}`
      jobs.push({ name: `monitoraggio-${kind}-${variant}-${locale}`, url: `${base}${prefix}/stampa/monitoraggio/fixture?fixture=${kind}&variant=${variant}` })
    }
  }
}
const only = process.argv[2]
mkdirSync('docs/pdf-esempi', { recursive: true })
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'], defaultViewport: { width: 1000, height: 1400 } })
for (const job of jobs) {
  if (only && !job.name.includes(only)) continue
  const t0 = Date.now()
  const page = await browser.newPage()
  await page.emulateMediaType('print')
  const res = await page.goto(job.url, { waitUntil: 'networkidle0', timeout: 60000 })
  if (!res.ok()) { console.log(`✗ ${job.name}: ${res.status()}`); await page.close(); continue }
  await page.waitForFunction('window.__REPORT_READY__ === true', { timeout: 30000 })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:8px;color:#8A94A0;text-align:right;padding:0 14mm 4mm 0;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>', margin: { top: 0, right: 0, bottom: 0, left: 0 } })
  writeFileSync(`docs/pdf-esempi/${job.name}.pdf`, pdf)
  console.log(`✓ ${job.name}.pdf ${(pdf.length / 1024).toFixed(0)} kB in ${Date.now() - t0} ms`)
  await page.close()
}
await browser.close()
