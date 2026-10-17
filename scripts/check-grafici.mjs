// Verifica visiva dei nuovi pannelli: login locale con l'account del titolare
// (magic link generato con la service key, nessuna email inviata), screenshot
// della scheda di Sara, della home e della pagina di stampa; raccoglie gli
// errori di console (idratazione compresa) e il testo dei pannelli.
import puppeteer from 'puppeteer-core'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:3778'
const out = process.env.OUT ?? '.'
const email = process.env.EMAIL
const clientId = process.env.CLIENT ?? '1788354294664'
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const url = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const ref = new URL(url).hostname.split('.')[0]

const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
if (error) throw new Error(`generateLink: ${error.message}`)
const { data: v, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
if (e2) throw new Error(`verifyOtp: ${e2.message}`)
const cookieValue = `base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`

mkdirSync(out, { recursive: true })
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const host = new URL(base).hostname

async function shot(name, path, width, opts = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 })
  await page.setCookie({ name: `sb-${ref}-auth-token`, value: cookieValue, domain: host, path: '/' })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 300)}`) })
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url().slice(0, 160)}`) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`))
  const t0 = Date.now()
  const res = await page.goto(`${base}${path}`, { waitUntil: 'networkidle0', timeout: 90000 })
  for (const txt of opts.clickText ?? []) {
    const ok = await page.evaluate((t) => {
      const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.trim().startsWith(t))
      if (b) { b.click(); return true }
      return false
    }, txt)
    console.log(`  click "${txt}": ${ok}`)
    await new Promise((r) => setTimeout(r, 900))
  }
  await new Promise((r) => setTimeout(r, 1200))
  const texts = await page.evaluate(() => Array.from(document.querySelectorAll('section[aria-label]')).map((s) => s.getAttribute('aria-label') + ' :: ' + s.innerText.replace(/\s+/g, ' ').slice(0, 400)))
  const svgTexts = await page.evaluate(() => Array.from(document.querySelectorAll('.recharts-wrapper text')).map((t) => t.textContent).filter(Boolean).join(' | ').slice(0, 1500))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  console.log(`\n== ${name} ${res.status()} ${Date.now() - t0} ms overflow=${overflow}`)
  for (const t of texts) console.log('  ' + t)
  console.log('  svg: ' + svgTexts)
  for (const e of errors) console.log('  ! ' + e)
  await page.close()
}

await shot('scheda-1280', `/area-professionisti/clienti/${clientId}`, 1280)
await shot('scheda-390', `/area-professionisti/clienti/${clientId}`, 390)
await shot('scheda-tutto', `/area-professionisti/clienti/${clientId}`, 1280, { clickText: ['Tutto'] })
await shot('prepara', `/area-professionisti/clienti/${clientId}`, 1280, { clickText: ['Prepara la vista'] })
await shot('cliente', `/area-professionisti/clienti/${clientId}`, 1280, { clickText: ['Mostra al cliente'] })
await shot('cliente-390', `/area-professionisti/clienti/${clientId}`, 390, { clickText: ['Mostra al cliente'] })
await shot('prima-dopo', `/area-professionisti/clienti/${clientId}?tab=prima-dopo`, 1280)
await shot('seduta', `/area-professionisti/clienti/${clientId}?tab=prima-dopo`, 1280, { clickText: ['Effetto della seduta'] })
await shot('home-1280', `/area-professionisti`, 1280)
await shot('analytics-1280', `/area-professionisti/clienti/${clientId}?tab=analytics`, 1280)
await shot('stampa', `/stampa/report-periodico?clientId=${clientId}&from=2026-09-18&to=2026-10-17`, 1000)
await shot('stampa-cliente', `/stampa/report-periodico?clientId=${clientId}&from=2026-09-18&to=2026-10-17&variant=client`, 1000)
await shot('stampa-fixture', `/stampa/report-periodico?fixture=report&from=2026-08-31&to=2026-09-30`, 1000)
// I due PDF veri dalla route (Chrome headless lato server), con il cookie di sessione.
for (const variant of ['pro', 'client']) {
  const t0 = Date.now()
  const res = await fetch(`${base}/api/pdf/report-periodico?clientId=${clientId}&from=2026-09-18&to=2026-10-17&locale=it&variant=${variant}`, { headers: { cookie: `sb-${ref}-auth-token=${cookieValue}` } })
  const buf = Buffer.from(await res.arrayBuffer())
  if (res.ok) writeFileSync(`${out}/report-${variant}.pdf`, buf)
  console.log(`\n== pdf ${variant} ${res.status} ${buf.length} bytes ${Date.now() - t0} ms count=${res.headers.get('x-measurement-count')}`)
}
await browser.close()
