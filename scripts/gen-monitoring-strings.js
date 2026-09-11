const fs = require('fs');
const APP = process.env.HOME + '/progetti/hrv_app/lib';
function extractMap(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('marker not found: ' + marker);
  const start = src.indexOf('{', i);
  let depth = 0, j = start, inStr = false, q = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (c === '\\') { j++; continue; } if (c === q) inStr = false; continue; }
    if (c === "'" || c === '"') { inStr = true; q = c; continue; }
    if (c === '/' && src[j+1] === '/') { j = src.indexOf('\n', j); continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  const body = src.slice(start, j + 1);
  // Dart single-quoted strings are JS-compatible; adjacent string literals concatenate in Dart, not in JS → join them.
  const js = body.replace(/'\s*\n\s*'/g, '');
  return Function('return (' + js + ')')();
}
const pdf = fs.readFileSync(APP + '/l10n/pdf_strings.dart', 'utf8');
const monitoring = extractMap(pdf, 'Map<String, Map<String, String>> monitoring =');
const indexTexts = extractMap(pdf, 'Map<String, Map<String, Map<String, String>>> indexTexts =');
const general = extractMap(pdf, 'Map<String, Map<String, String>> strings =');
const sleepSrc = fs.readFileSync(APP + '/l10n/sleep_pdf_strings.dart', 'utf8');
const sleep = extractMap(sleepSrc, 'Map<String, Map<String, String>> strings =');
// IT index texts from monitoring_index_texts.dart
const idx = fs.readFileSync(APP + '/l10n/monitoring_index_texts.dart', 'utf8');
const idMap = {};
const advSrc = fs.readFileSync(APP + '/models/monitoring/monitoring_advanced.dart', 'utf8');
for (const m of advSrc.matchAll(/static const (\w+) = '([a-z_0-9]+)';/g)) idMap[m[1]] = m[2];
const it = {};
{
  const block = idx.slice(idx.indexOf('static const List<MonitoringIndexText> all = ['), idx.indexOf('static MonitoringIndexText of('));
  const chunks = block.split('MonitoringIndexText(').slice(1);
  const strRe = (name) => new RegExp(name + ":\\s*('(?:[^'\\\\]|\\\\.)*')");
  for (const body of chunks) {
    const idm = /id: MonitoringIndexId\.(\w+)/.exec(body);
    if (!idm) continue;
    const id = idMap[idm[1]];
    const field = (name) => { const f = strRe(name).exec(body); return f ? Function('return ' + f[1])() : null; };
    it[id] = { name: field('name'), phrase: field('phrase'), tech: field('technicalName'), method: field('method'), req: field('requirement'), ref: field('reference'), proOnly: /proOnly:\s*true/.test(body) };
  }
}
const scoreKeys = ['stress_score','recovery_score','balance_score','energy_score','inflammatory_score'];
const scores = {};
for (const lang of ['it','en','de']) { scores[lang] = {}; for (const k of scoreKeys) scores[lang][k] = general[lang]?.[k] ?? general.it[k]; }
const out = `// GENERATO da ~/progetti/hrv_app/lib/l10n/pdf_strings.dart e monitoring_index_texts.dart
// con scripts/gen-monitoring-strings.js. NON modificare a mano: i testi devono
// restare identici a quelli dell'app (stessi nomi, stesse frasi, stesse
// referenze). Per cambiarli si cambia l'app e si rigenera.

export type Lang = 'it' | 'en' | 'de'
export const MONITORING_LANGS: Lang[] = ['it', 'en', 'de']

/** Stringhe di pagina del report 24h (PdfStrings.monitoring). */
export const MONITORING_STRINGS: Record<Lang, Record<string, string>> = ${JSON.stringify(monitoring, null, 2)}

export type IndexId = ${Object.keys(it).map(k => `'${k}'`).join(' | ')}

export interface IndexText {
  name: string
  phrase: string
  tech: string
  method: string
  req: string
  ref: string
  proOnly: boolean
}

/** Testi dei due livelli di ogni indice. IT = MonitoringIndexTexts (fonte di verità), EN/DE = PdfStrings.indexTexts. */
export const INDEX_TEXTS: Record<Lang, Record<IndexId, IndexText>> = {
  it: ${JSON.stringify(it, null, 2)},
  en: ${JSON.stringify(Object.fromEntries(Object.entries(indexTexts.en).map(([k,v]) => [k, {...v, proOnly: it[k]?.proOnly ?? false}])), null, 2)},
  de: ${JSON.stringify(Object.fromEntries(Object.entries(indexTexts.de).map(([k,v]) => [k, {...v, proOnly: it[k]?.proOnly ?? false}])), null, 2)},
}

/** Nomi dei cinque score proprietari (PdfStrings.strings, chiavi *_score). */
export const SCORE_STRINGS: Record<Lang, Record<string, string>> = ${JSON.stringify(scores, null, 2)}

export function monT(key: string, lang: Lang = 'it'): string {
  return MONITORING_STRINGS[lang]?.[key] ?? MONITORING_STRINGS.it[key] ?? key
}

export function indexText(id: IndexId, lang: Lang = 'it'): IndexText {
  return INDEX_TEXTS[lang]?.[id] ?? INDEX_TEXTS.it[id]
}

export function scoreT(key: string, lang: Lang = 'it'): string {
  return SCORE_STRINGS[lang]?.[key] ?? SCORE_STRINGS.it[key] ?? key
}
`;
fs.writeFileSync('src/lib/monitoring-strings.ts', out);
const outSleep = `// GENERATO da ~/progetti/hrv_app/lib/l10n/sleep_pdf_strings.dart con
// scripts/gen-monitoring-strings.js. NON modificare a mano: i testi restano
// identici a quelli dell'app.

import type { Lang } from './monitoring-strings'

export const SLEEP_STRINGS: Record<Lang, Record<string, string>> = ${JSON.stringify(sleep, null, 2)}

export function sleepT(key: string, lang: Lang = 'it'): string {
  return SLEEP_STRINGS[lang]?.[key] ?? SLEEP_STRINGS.it[key] ?? key
}
`;
fs.writeFileSync('src/lib/sleep-strings.ts', outSleep);
console.log('monitoring keys it/en/de:', Object.keys(monitoring.it).length, Object.keys(monitoring.en).length, Object.keys(monitoring.de).length);
console.log('index it/en/de:', Object.keys(it).length, Object.keys(indexTexts.en).length, Object.keys(indexTexts.de).length);
console.log('sleep it/en/de:', Object.keys(sleep.it).length, Object.keys(sleep.en).length, Object.keys(sleep.de).length);
console.log('scores', scores.it);
