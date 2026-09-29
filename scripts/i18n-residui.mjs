#!/usr/bin/env node
// Cerca stringhe italiane rimaste hardcoded nei sorgenti (.ts/.tsx sotto src/),
// escludendo commenti e i file generati/trilingue per costruzione.
// Euristica: testo JSX o literal stringa con lettere accentate italiane o con
// parole funzionali italiane comuni. Produce falsi positivi: è un aiuto alla
// revisione, non un test.
//
// Uso: node scripts/i18n-residui.mjs [--strict]   (exit 1 con --strict se trova qualcosa)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const SKIP = [
  'src/lib/monitoring-strings.ts', // generato dall'app, già IT/EN/DE
  'src/lib/sleep-strings.ts', // già IT/EN/DE
  'src/lib/guide-knowledge-base.ts', // contesto del modello, non visibile
]

const ITALIAN_WORDS = /\b(il|lo|la|gli|le|della|delle|dello|degli|nel|nella|nei|negli|con|per|che|non|una|uno|sono|questo|questa|questi|misurazion[ei]|client[ei]|professionist[ai]|sessione|giorni|settimana|nessun[ao]?|tutti|ultim[oaie]|prim[oaie]|dopo|prima|oggi|ieri|riprova|salva|annulla|elimina|modifica|chiudi|conferma|cerca|caricamento|errore|attenzione|nuovo|nuova|vedi|scarica|invia|aggiungi|rimuovi|attiv[oaie]|sospes[oa]|bloccat[oa])\b/i
const ACCENTS = /[àèéìòù]/

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) yield p
  }
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '))
}

let total = 0
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  if (SKIP.includes(rel)) continue
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n')
  const hits = []
  lines.forEach((line, i) => {
    // testo JSX: >  testo  <
    const jsx = />\s*([^<>{}]*[A-Za-zÀ-ú][^<>{}]*)\s*</g
    let m
    while ((m = jsx.exec(line))) {
      const text = m[1].trim()
      if (text.length < 3) continue
      if (ACCENTS.test(text) || (ITALIAN_WORDS.test(text) && /\s/.test(text))) hits.push({ i, text })
    }
    // literal stringhe con più parole
    const lit = /(['"`])((?:(?!\1)[^\\\n]|\\.){6,})\1/g
    while ((m = lit.exec(line))) {
      const text = m[2]
      if (/^[a-z0-9_./#@?&=:%-]+$/i.test(text)) continue // chiavi, classi, URL, path
      if (/^[\w.-]+\s[\w.-]+$/.test(text) && !ACCENTS.test(text) && !ITALIAN_WORDS.test(text)) continue
      if (/(className|class=|http|\.json|\.tsx?|from |import )/.test(line)) continue
      if (ACCENTS.test(text) || (ITALIAN_WORDS.test(text) && /\s/.test(text))) hits.push({ i, text })
    }
  })
  if (hits.length) {
    total += hits.length
    console.log(`\n${rel}`)
    for (const h of hits.slice(0, 40)) console.log(`  ${h.i + 1}: ${h.text.slice(0, 110)}`)
    if (hits.length > 40) console.log(`  … altre ${hits.length - 40}`)
  }
}
console.log(`\n${total} possibili stringhe italiane residue.`)
if (process.argv.includes('--strict') && total > 0) process.exit(1)
