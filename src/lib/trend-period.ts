// =============================================================================
// Periodo dei grafici di andamento: dai preset alle date, e il filtro dei punti
// =============================================================================
//
// Modulo puro (niente React): lo usa `AdvancedTrendChart` e lo coprono i test.
// Le date sono chiavi di giorno `yyyy-MM-dd` nel fuso italiano, le stesse di
// `measuredDayKey`: "oggi" è il giorno italiano, non quello del browser, così
// vicino alla mezzanotte il punto di oggi non sparisce e server e client sono
// d'accordo. "7 giorni" copre 7 giorni (oggi compreso), non 8.

import { giornoItaFa, oggiIta } from './measured-time.ts'

export type PresetKey = '7' | '30' | '90' | '180' | '365' | 'all' | 'custom'

export const PRESETS: Array<{ key: PresetKey; labelKey: string; days: number | null }> = [
  { key: '7', labelKey: 'd7', days: 7 },
  { key: '30', labelKey: 'd30', days: 30 },
  { key: '90', labelKey: 'd90', days: 90 },
  { key: '180', labelKey: 'm6', days: 180 },
  { key: '365', labelKey: 'y1', days: 365 },
  { key: 'all', labelKey: 'all', days: null },
]

export const PRESET_KEYS: ReadonlySet<string> = new Set<string>([...PRESETS.map((p) => p.key), 'custom'])

export type Periodo = { from: string; to: string } | null

/**
 * Estremi (inclusi) del periodo scelto. `null` per "Tutto". Per i preset a
 * giorni il primo giorno è `oggi - (days - 1)`.
 */
export function periodoDaPreset(
  key: PresetKey,
  custom: { from: string; to: string },
  now: Date = new Date(),
): Periodo {
  if (key === 'all') return null
  if (key === 'custom') return { from: custom.from, to: custom.to }
  const p = PRESETS.find((x) => x.key === key)
  const days = p?.days ?? 30
  return { from: giornoItaFa(days - 1, now), to: oggiIta(now) }
}

/** Punti con `date` dentro il periodo (confronto fra chiavi `yyyy-MM-dd`). */
export function filtraPerPeriodo<T extends { date: string }>(data: T[], periodo: Periodo): T[] {
  if (!periodo) return data
  return data.filter((p) => p.date >= periodo.from && p.date <= periodo.to)
}

/** Primo e ultimo giorno davvero coperti dai punti (per la didascalia). */
export function estremiDeiPunti<T extends { date: string }>(data: T[]): { from: string; to: string } | null {
  if (data.length === 0) return null
  let from = data[0].date
  let to = data[0].date
  for (const p of data) {
    if (p.date < from) from = p.date
    if (p.date > to) to = p.date
  }
  return { from, to }
}
