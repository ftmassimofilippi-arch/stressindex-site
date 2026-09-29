#!/usr/bin/env node
// Controllo dei file messaggi:
//   1. le chiavi di it.json, en.json e de.json devono coincidere (fallisce se
//      ne manca anche una, in qualsiasi direzione);
//   2. nessun termine vietato dal linguaggio wellness nei testi delle tre lingue;
//   3. nessun trattino lungo "—" nei testi italiani.
//
// Uso: node scripts/i18n-check.mjs   (exit 1 in caso di errori)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const LOCALES = ['it', 'en', 'de']

const FORBIDDEN = [
  // it
  /\bdiagnos[ie]\b/i, /\bdiagnostic[oaih]\b/i, /\bpazient[ei]\b/i, /\bcartell[ae] clinic[ah]/i, /\brefert[oi]\b/i,
  /\bclinic[oaih]\b/i, /\bbiomarcator[ei]\b/i, /\bterapi[ae]\b/i, /\bterapeutic[oaih]\b/i,
  /\bmodulazione infiammatoria\b/i,
  // en
  /\bdiagnos(is|es|e|tic)\b/i, /\bpatients?\b/i, /\bmedical records?\b/i, /\bmedical reports?\b/i,
  /\bclinical\b/i, /\bbiomarkers?\b/i, /\btherap(y|ies|eutic)\b/i, /\binflammatory modulation\b/i,
  // de
  /\bDiagnose[n]?\b/, /\bdiagnostisch/i, /\bPatient(en|in|innen)?\b/, /\bKrankenakte/i, /\bBefund/i,
  /\bklinisch/i, /\bBiomarker/i, /\bTherapie/i, /\btherapeutisch/i, /\bEntzündungsmodulation/i,
]

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out[key] = v
  }
  return out
}

const flat = {}
for (const l of LOCALES) {
  flat[l] = flatten(JSON.parse(readFileSync(join(ROOT, 'messages', `${l}.json`), 'utf8')))
}

let errors = 0

// 1. Chiavi
const itKeys = new Set(Object.keys(flat.it))
for (const l of ['en', 'de']) {
  const keys = new Set(Object.keys(flat[l]))
  for (const k of itKeys) if (!keys.has(k)) { console.error(`✗ ${l}.json: manca la chiave ${k}`); errors++ }
  for (const k of keys) if (!itKeys.has(k)) { console.error(`✗ ${l}.json: chiave in più ${k}`); errors++ }
}

// 2. Termini vietati e 3. trattino lungo
for (const l of LOCALES) {
  for (const [k, v] of Object.entries(flat[l])) {
    if (typeof v !== 'string') continue
    // I disclaimer legali dicono cosa il prodotto NON è ("non costituisce diagnosi"):
    // sono esenti dal controllo dei termini, non dagli altri.
    const isDisclaimer = /disclaimer/i.test(k)
    for (const re of isDisclaimer ? [] : FORBIDDEN) {
      const m = re.exec(v)
      if (m) { console.error(`✗ ${l}.json ${k}: termine vietato "${m[0]}"`); errors++ }
    }
    if (l === 'it' && v.includes('—')) { console.error(`✗ it.json ${k}: trattino lungo`); errors++ }
    if (v.trim() === '') { console.error(`✗ ${l}.json ${k}: testo vuoto`); errors++ }
  }
}

const total = itKeys.size
if (errors) {
  console.error(`\n${errors} problemi su ${total} chiavi.`)
  process.exit(1)
}
console.log(`✓ ${total} chiavi allineate in it/en/de, nessun termine vietato.`)
