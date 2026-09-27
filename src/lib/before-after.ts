// =============================================================================
// Coppie "prima e dopo" — porting 1:1 di lib/utils/before_after_pairs.dart
// =============================================================================
//
// Una misurazione con etichetta pre seguita da una con etichetta post, dello
// stesso cliente, nello stesso giorno. Regola di accoppiamento (identica
// all'app, coperta da test):
// - stesso cliente;
// - stesso giorno, nel fuso della misurazione (Europa/Roma, come il resto del
//   sito: measuredDayKey);
// - pre trattamento → post trattamento, pre allenamento → post allenamento,
//   mai incrociati;
// - il post viene DOPO il pre;
// - con più pre e più post nello stesso giorno, ogni post si accoppia con il
//   pre precedente più vicino nel tempo. Due post dopo lo stesso pre danno due
//   coppie con lo stesso pre.
//
// Nessun accesso al database: funzioni pure su righe già lette.

export type BeforeAfterKind = 'treatment' | 'workout'

/** Il minimo che serve per accoppiare: id, cliente, istante reale, giorno, tag. */
export interface PairableRow {
  id: string
  clientId: string | null
  /** Istante reale della misurazione (ms epoch), già normalizzato. */
  instantMs: number
  /** Giorno di calendario 'YYYY-MM-DD' nel fuso della misurazione. */
  dayKey: string
  tags: string[] | null
}

export interface BeforeAfterPair<T extends PairableRow = PairableRow> {
  pre: T
  post: T
  kind: BeforeAfterKind
}

// ── Etichette: chiavi neutre e le etichette storiche italiane ────────────────
// Stessa tabella di MeasurementTag.normalizeKey nell'app. Le sessioni salvate
// prima delle chiavi neutre portano l'etichetta italiana.

export const TAG_KEYS = {
  morning: 'morning',
  guidedBreathing: 'guided_breathing',
  preSession: 'pre_session',
  postSession: 'post_session',
  preWorkout: 'pre_workout',
  postWorkout: 'post_workout',
  general: 'general',
} as const

const KNOWN = new Set<string>(Object.values(TAG_KEYS))

const LEGACY: Record<string, string> = {
  'misurazione mattutina': TAG_KEYS.morning,
  'respirazione guidata': TAG_KEYS.guidedBreathing,
  'pre sessione': TAG_KEYS.preSession,
  'pre trattamento': TAG_KEYS.preSession,
  'post sessione': TAG_KEYS.postSession,
  'post trattamento': TAG_KEYS.postSession,
  'pre allenamento': TAG_KEYS.preWorkout,
  'post allenamento': TAG_KEYS.postWorkout,
  'monitoraggio generico': TAG_KEYS.general,
  // Etichette tradotte (inglese) mostrate dall'app.
  'morning measurement': TAG_KEYS.morning,
  'guided breathing': TAG_KEYS.guidedBreathing,
  'before session': TAG_KEYS.preSession,
  'after session': TAG_KEYS.postSession,
  'before workout': TAG_KEYS.preWorkout,
  'after workout': TAG_KEYS.postWorkout,
  'general check-in': TAG_KEYS.general,
}

/** Etichette in italiano dei preset, nell'ordine in cui l'app li propone. */
export const TAG_LABEL: Record<string, string> = {
  [TAG_KEYS.morning]: 'Misurazione mattutina',
  [TAG_KEYS.guidedBreathing]: 'Respirazione guidata',
  [TAG_KEYS.preSession]: 'Pre sessione',
  [TAG_KEYS.postSession]: 'Post sessione',
  [TAG_KEYS.preWorkout]: 'Pre allenamento',
  [TAG_KEYS.postWorkout]: 'Post allenamento',
  [TAG_KEYS.general]: 'Monitoraggio generico',
}

export const TAG_PRESET_ORDER: string[] = [
  TAG_KEYS.morning,
  TAG_KEYS.guidedBreathing,
  TAG_KEYS.preSession,
  TAG_KEYS.postSession,
  TAG_KEYS.preWorkout,
  TAG_KEYS.postWorkout,
  TAG_KEYS.general,
]

/** Riporta un valore salvato (chiave neutra, etichetta storica o tradotta)
 *  alla chiave neutra. Un tag personalizzato resta invariato. */
export function normalizeTagKey(stored: string): string {
  const t = stored.trim()
  if (KNOWN.has(t)) return t
  return LEGACY[t.toLowerCase()] ?? t
}

/** Etichetta da mostrare per un tag salvato (personalizzati tali e quali). */
export function tagLabel(stored: string): string {
  return TAG_LABEL[normalizeTagKey(stored)] ?? stored.trim()
}

/** Chiavi presenti nelle righe, preset prima nell'ordine dell'app, poi i
 *  personalizzati in ordine alfabetico, con i conteggi (un tag conta una
 *  volta per riga). */
export function tagCounts(rows: Array<{ tags: string[] | null }>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const seen = new Set<string>()
    for (const t of r.tags ?? []) {
      const k = normalizeTagKey(t)
      if (!k || seen.has(k)) continue
      seen.add(k)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  const ordered = new Map<string, number>()
  for (const k of TAG_PRESET_ORDER) if (counts.has(k)) ordered.set(k, counts.get(k)!)
  const custom = Array.from(counts.keys())
    .filter((k) => !TAG_PRESET_ORDER.includes(k))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  for (const k of custom) ordered.set(k, counts.get(k)!)
  return ordered
}

export function rowHasTag(row: { tags: string[] | null }, key: string): boolean {
  return (row.tags ?? []).some((t) => normalizeTagKey(t) === key)
}

// ── Accoppiamento ────────────────────────────────────────────────────────────

function preKind(row: PairableRow): BeforeAfterKind | null {
  for (const t of row.tags ?? []) {
    const k = normalizeTagKey(t)
    if (k === TAG_KEYS.preSession) return 'treatment'
    if (k === TAG_KEYS.preWorkout) return 'workout'
  }
  return null
}

function postKind(row: PairableRow): BeforeAfterKind | null {
  for (const t of row.tags ?? []) {
    const k = normalizeTagKey(t)
    if (k === TAG_KEYS.postSession) return 'treatment'
    if (k === TAG_KEYS.postWorkout) return 'workout'
  }
  return null
}

/** Le coppie trovate, dalla più recente (istante del post). */
export function pairBeforeAfter<T extends PairableRow>(rows: T[]): BeforeAfterPair<T>[] {
  const pres = new Map<string, T[]>()
  const posts = new Map<string, T[]>()
  const keyOf = (r: T, k: BeforeAfterKind) => `${r.clientId ?? ''}|${r.dayKey}|${k}`

  for (const r of rows) {
    const pk = preKind(r)
    if (pk) {
      const key = keyOf(r, pk)
      pres.set(key, [...(pres.get(key) ?? []), r])
    }
    const qk = postKind(r)
    if (qk) {
      const key = keyOf(r, qk)
      posts.set(key, [...(posts.get(key) ?? []), r])
    }
  }

  const out: BeforeAfterPair<T>[] = []
  for (const [key, postList] of posts) {
    const candidates = pres.get(key)
    if (!candidates || candidates.length === 0) continue
    const kind: BeforeAfterKind = key.endsWith('workout') ? 'workout' : 'treatment'
    for (const post of postList) {
      let best: T | null = null
      for (const pre of candidates) {
        if (pre.id === post.id) continue
        if (!(pre.instantMs < post.instantMs)) continue
        if (best == null || pre.instantMs > best.instantMs) best = pre
      }
      if (best) out.push({ pre: best, post, kind })
    }
  }
  out.sort((a, b) => b.post.instantMs - a.post.instantMs)
  return out
}

// ── Delta e semantica (freccia = direzione del numero, colore = significato) ─

/** Per lo Stress il calo è un miglioramento; per gli altri score la salita. */
export const SCORE_DELTA_ROWS: Array<{ key: 'score_stress' | 'score_recupero' | 'score_equilibrio' | 'score_energia' | 'score_modulazione_infiammatoria'; label: string; higherIsBetter: boolean }> = [
  { key: 'score_stress', label: 'Stress', higherIsBetter: false },
  { key: 'score_recupero', label: 'Recupero', higherIsBetter: true },
  { key: 'score_equilibrio', label: 'Equilibrio', higherIsBetter: true },
  { key: 'score_energia', label: 'Energia', higherIsBetter: true },
  // Colonna DB score_modulazione_infiammatoria, mostrata come "Adattamento".
  { key: 'score_modulazione_infiammatoria', label: 'Adattamento', higherIsBetter: true },
]

export type DeltaVerdict = 'improved' | 'declined' | 'stable' | 'unknown'

export function deltaVerdict(a: number | null, b: number | null, higherIsBetter: boolean, stableBelow = 3): DeltaVerdict {
  if (a == null || b == null) return 'unknown'
  const delta = b - a
  if (Math.abs(delta) < stableBelow) return 'stable'
  const improvement = higherIsBetter ? delta : -delta
  return improvement > 0 ? 'improved' : 'declined'
}
