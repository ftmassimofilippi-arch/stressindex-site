// =============================================================================
// Controllo di idratazione della scheda cliente (da lanciare su una build)
// =============================================================================
//
// Apre la scheda di uno o più clienti in Chrome headless, con il login del
// titolare fatto in locale come in `check-grafici.mjs` (magic link generato
// con la service key, nessuna email inviata), e FALLISCE se in console compare
// un errore di idratazione di React (#418, #419, #422, #423, #425, o il testo
// "Hydration failed" / "did not match" della build di sviluppo).
//
// Controlla anche che i pulsanti del periodo del grafico rispondano: dopo il
// clic su "7 giorni", "1 anno" e "Tutto" il pulsante attivo deve cambiare.
// È la regressione vista sull'anteprima del 20/10/2026.
//
// USO (contro una build, come la fa Vercel):
//   npm run build && PDF_TOKEN_SECRET=solo-test npx next start -p 3778 &
//   EMAIL=info@massimofilippi.it CLIENT=1781087319397,1791988302283 node scripts/check-idratazione-scheda.mjs
//
// Variabili: BASE (default http://localhost:3778), EMAIL (obbligatoria),
// CLIENT (id separati da virgola; default: i due clienti del caso del 20/10),
// OUT (cartella per gli screenshot, facoltativa), CHROME (eseguibile).
// Esce con 1 se almeno un controllo fallisce.
import puppeteer from 'puppeteer-core'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync } from 'node:fs'

const base = process.env.BASE ?? 'http://localhost:3778'
const out = process.env.OUT
const email = process.env.EMAIL
const clients = (process.env.CLIENT ?? '1781087319397,1791988302283').split(',').map((s) => s.trim()).filter(Boolean)
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!email) {
  console.error('EMAIL mancante: serve l\'email del professionista che possiede le schede.')
  process.exit(2)
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }),
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const ref = new URL(url).hostname.split('.')[0]

const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
if (error) throw new Error(`generateLink: ${error.message}`)
const { data: v, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
if (e2) throw new Error(`verifyOtp: ${e2.message}`)
const cookieValue = `base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`

const HYDRATION = /Minified React error #(418|419|422|423|425)|Hydration failed|did not match|Text content does not match|hydrat/i
const PRESETS = ['7 giorni', '1 anno', 'Tutto']

if (out) mkdirSync(out, { recursive: true })
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] })
const host = new URL(base).hostname
let failures = 0

for (const clientId of clients) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
  // Fuso del browser: il server gira in UTC (Vercel) e il professionista può
  // essere ovunque. `BROWSER_TZ=Asia/Bangkok` riproduce un browser a +7.
  if (process.env.BROWSER_TZ) await page.emulateTimezone(process.env.BROWSER_TZ)
  // Anteprima Vercel protetta: `SHARE_URL` è il link con `_vercel_share` che
  // imposta il cookie di accesso; si apre prima della scheda.
  if (process.env.SHARE_URL) await page.goto(process.env.SHARE_URL, { waitUntil: 'networkidle0', timeout: 90000 })
  await page.setCookie({ name: `sb-${ref}-auth-token`, value: cookieValue, domain: host, path: '/' })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 400)}`) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 400)}`))

  // `QS` aggiunge una query alla scheda, per esempio `?professionista=<uid>`
  // per la vista "come un altro professionista" del superadmin.
  const path = `/area-professionisti/clienti/${clientId}${process.env.QS ?? ''}`
  const res = await page.goto(`${base}${path}`, { waitUntil: 'networkidle0', timeout: 90000 })
  await new Promise((r) => setTimeout(r, 1500))
  console.log(`\n== scheda ${clientId}: HTTP ${res.status()}`)
  if (res.status() !== 200) { failures++; console.log('  ✗ la scheda non risponde 200 (login o perimetro?)') }

  const hydration = errors.filter((e) => HYDRATION.test(e))
  if (hydration.length) {
    failures++
    console.log(`  ✗ ${hydration.length} errori di idratazione:`)
    for (const e of hydration) console.log('    ' + e)
  } else {
    console.log('  ✓ nessun errore di idratazione')
  }

  // Pulsanti del periodo: il pulsante cliccato deve diventare quello attivo.
  const activeLabel = () => page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.className.includes('bg-teal-dark') && /giorni|anno|Tutto|Personalizzato/.test(x.textContent ?? ''))
    return b?.textContent?.trim() ?? null
  })
  const before = await activeLabel()
  for (const label of PRESETS) {
    const clicked = await page.evaluate((t) => {
      const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.trim() === t)
      if (b) { b.click(); return true }
      return false
    }, label)
    await new Promise((r) => setTimeout(r, 700))
    const now = await activeLabel()
    if (!clicked) { failures++; console.log(`  ✗ pulsante "${label}" non trovato`); continue }
    if (now === label) console.log(`  ✓ periodo "${label}" attivo dopo il clic (prima: ${before})`)
    else { failures++; console.log(`  ✗ dopo il clic su "${label}" il periodo attivo è "${now}"`) }
  }

  const other = errors.filter((e) => !HYDRATION.test(e) && !/favicon/.test(e))
  if (other.length) {
    console.log(`  (altri messaggi in console: ${other.length})`)
    for (const e of other.slice(0, 8)) console.log('    ' + e)
  }
  if (out) await page.screenshot({ path: `${out}/scheda-${clientId}.png`, fullPage: true })
  await page.close()
}

await browser.close()
if (failures) {
  console.log(`\n${failures} controlli falliti`)
  process.exit(1)
}
console.log('\nTutti i controlli passati')
