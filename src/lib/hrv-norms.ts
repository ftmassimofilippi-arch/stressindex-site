// Range di riferimento per età, sesso e livello di attività dalla tabella
// `hrv_norms` del database (Nunan 2010, Voss 2015, Schumann & Bär 2022).
// Modulo puro, senza import: lo usano hrv-norms-server.ts, la tabella dei
// parametri (anche nel client) e i test (`node --test`).
//
// Il sito NON ricalcola score: legge p25 e p75 della fascia del cliente e li
// mostra come intervallo di riferimento (solo RMSSD e SDNN, vedi
// NORM_METRIC_FIELD); il semaforo applica al range personale la stessa
// tolleranza del generico (`rangeStatus` di hrv-reference.ts). Le regole di fascia sono copie
// esatte di quelle già esistenti; se cambiano lì, cambiano qui:
//   - età   → `public.hrv_age_group(p_age)` (SQL) e `AgeGroup` in
//             hrv_app/lib/utils/demographic_normalization.dart
//   - sesso → `DemographicProfile.fromFields`: 'M' maschio, 'F' femmina,
//             tutto il resto sconosciuto
//   - attività → `DemographicProfile.fromFields`: atleta = true o
//             livello 'atleta' → athlete; 'attivo' o 'moderato' → active;
//             qualunque altro valore (anche nullo) → sedentary

export type NormSex = 'male' | 'female'
export type NormAgeGroup = 'young' | 'midAdult' | 'senior' | 'elderly'
export type NormFitness = 'sedentary' | 'active' | 'athlete'
export type NormRange = [number, number]

export type NormProfile = { sex: NormSex; ageGroup: NormAgeGroup; fitness: NormFitness }

/** Replica di `public.hrv_age_group`: ≤30 young, ≤45 midAdult, ≤60 senior, oltre elderly. */
export function hrvAgeGroup(age: number | null | undefined): NormAgeGroup | null {
  if (age == null || !Number.isFinite(age)) return null
  if (age <= 30) return 'young'
  if (age <= 45) return 'midAdult'
  if (age <= 60) return 'senior'
  return 'elderly'
}

export function normSex(sesso: string | null | undefined): NormSex | null {
  if (sesso === 'M') return 'male'
  if (sesso === 'F') return 'female'
  return null
}

export function normFitness(atleta: boolean | null | undefined, livello: string | null | undefined): NormFitness {
  if (atleta === true || livello === 'atleta') return 'athlete'
  if (livello === 'attivo' || livello === 'moderato') return 'active'
  return 'sedentary'
}

/**
 * Metrica di `hrv_norms.metric` → colonna di `measurement_analytics`.
 * Dal 23/10/2026 (DECISIONI.md, decisioni 1, 3, 4, 12) le norme per età e
 * sesso valgono SOLO per RMSSD e SDNN: DFA α1 e Stress Index di Baevsky usano
 * le soglie fisse dell'Appendice A, LF/HF non ha più semaforo. Le righe
 * `dfa`, `si` e `lfhf` della tabella restano nel database ma si scartano.
 */
export const NORM_METRIC_FIELD: Record<string, string> = {
  rmssd: 'rmssd',
  sdnn: 'sdnn',
}

export type NormMissing = 'sex' | 'birthDate'

export type NormProfileResult =
  | { ok: true; profile: NormProfile }
  /** `sexOther`: sesso indicato ma non M/F, per cui le tabelle non hanno righe. */
  | { ok: false; missing: NormMissing[]; sexOther: boolean }

/** Profilo per le norme dai campi del cliente; `age` in anni (o null). */
export function normProfileFromClient(
  client: { sesso?: string | null; atleta?: boolean | null; livello_attivita?: string | null },
  age: number | null,
): NormProfileResult {
  const sex = normSex(client.sesso)
  const ageGroup = hrvAgeGroup(age)
  if (!sex || !ageGroup) {
    const sexOther = !sex && !!client.sesso
    const missing: NormMissing[] = []
    if (!sex && !sexOther) missing.push('sex')
    if (!ageGroup) missing.push('birthDate')
    return { ok: false, missing, sexOther }
  }
  return { ok: true, profile: { sex, ageGroup, fitness: normFitness(client.atleta, client.livello_attivita) } }
}

/**
 * Righe di `hrv_norms` (già filtrate sul profilo) → range p25-p75 per colonna
 * di `measurement_analytics`. Righe con metrica sconosciuta o numeri non
 * validi si scartano.
 */
export function rangesFromNormRows(
  rows: Array<{ metric: string; p25: unknown; p75: unknown }>,
): Record<string, NormRange> {
  const out: Record<string, NormRange> = {}
  for (const r of rows) {
    const field = NORM_METRIC_FIELD[r.metric]
    const lo = typeof r.p25 === 'string' ? Number(r.p25) : r.p25
    const hi = typeof r.p75 === 'string' ? Number(r.p75) : r.p75
    if (!field || typeof lo !== 'number' || typeof hi !== 'number' || !Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) continue
    out[field] = [lo, hi]
  }
  return out
}

/** Esito per un cliente: range personali, dati anagrafici mancanti, tabella non disponibile. */
export type ClientNorms =
  | { kind: 'personal'; profile: NormProfile; ranges: Record<string, NormRange> }
  | { kind: 'missing'; missing: NormMissing[]; sexOther: boolean }
  | { kind: 'unavailable' }

/** Estremi della fascia d'età per l'etichetta ("61+" ha solo il minimo). */
export const AGE_GROUP_BOUNDS: Record<NormAgeGroup, { from: number | null; to: number | null }> = {
  young: { from: null, to: 30 },
  midAdult: { from: 31, to: 45 },
  senior: { from: 46, to: 60 },
  elderly: { from: 61, to: null },
}
