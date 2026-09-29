#!/usr/bin/env node
// Unisce i frammenti per namespace in messages/_parts/<locale>/<namespace>.json
// nei file finali messages/<locale>.json (che vengono RIGENERATI da zero: la
// fonte di verità sono i frammenti). Un frammento contiene le chiavi del
// SUO namespace (oggetto radice = contenuto del namespace). Namespace uguali in
// più frammenti (es. common.a.json, common.b.json) vengono fusi in profondità.
//
// Uso: node scripts/i18n-merge.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const PARTS = join(ROOT, 'messages', '_parts')
const LOCALES = ['it', 'en', 'de']

function deepMerge(target, source, path = '') {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (target[k] && typeof target[k] !== 'object') {
        throw new Error(`Conflitto di tipo su ${path}${k}`)
      }
      target[k] = deepMerge(target[k] ?? {}, v, `${path}${k}.`)
    } else {
      if (k in target && target[k] !== v) {
        console.warn(`⚠️  chiave duplicata con valore diverso: ${path}${k}`)
      }
      target[k] = v
    }
  }
  return target
}

function sortKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortKeys(obj[k])]))
}

for (const locale of LOCALES) {
  const dir = join(PARTS, locale)
  const out = join(ROOT, 'messages', `${locale}.json`)
  const merged = {}
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const ns = basename(file, '.json').split('.')[0]
      let data
      try {
        data = JSON.parse(readFileSync(join(dir, file), 'utf8'))
      } catch (e) {
        throw new Error(`JSON non valido in messages/_parts/${locale}/${file}: ${e.message}`)
      }
      merged[ns] = deepMerge(merged[ns] ?? {}, data, `${ns}.`)
    }
  }
  mkdirSync(join(ROOT, 'messages'), { recursive: true })
  writeFileSync(out, JSON.stringify(sortKeys(merged), null, 2) + '\n')
  console.log(`messages/${locale}.json: ${Object.keys(merged).length} namespace`)
}
