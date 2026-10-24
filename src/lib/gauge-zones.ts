// Fasce degli score (soglie e colori identici a score_zones.dart dell'app e
// all'Appendice A del manuale). Modulo puro: usato dal tachimetro (client),
// dalle barre delle liste, dalla heatmap, dai PDF e dalle pagine di stampa
// (server), che non possono importare funzioni da un modulo 'use client'.
//
// È l'unica origine delle scale di colore degli score nel sito: ogni
// componente che colora uno score deve passare da `scoreZoneColor`, mai da
// una scala locale (vedi gauge-zones.test.ts).

export type GaugeColorScheme = 'stress' | 'recovery' | 'balance' | 'energy' | 'adaptation'

// Palette allineata ad AppColors dell'app
export const GREEN = '#2F8F6B' // AppColors.success
export const DARK_GREEN = '#1F6B4E'
export const YELLOW = '#C78A2C' // AppColors.warning
export const ORANGE = '#E67E22'
export const RED = '#C44E4E' // AppColors.error
export const DARK_RED = '#A93226'

/** Cinque colori dal peggiore al migliore per gli score "alto = bene"
 *  (Recupero, Equilibrio, Energia, Adattamento): rosso, arancio, giallo,
 *  verde, verde scuro (decisione 15). */
export const POSITIVE_SCORE_COLORS: readonly [string, string, string, string, string] = [RED, ORANGE, YELLOW, GREEN, DARK_GREEN]

/** Cinque colori dal migliore al peggiore per lo Stress ("basso = bene"):
 *  verde, giallo, arancio, rosso, rosso scuro (decisione 15). */
export const STRESS_SCORE_COLORS: readonly [string, string, string, string, string] = [GREEN, YELLOW, ORANGE, RED, DARK_RED]

/** Sotto questa differenza (punti) due score si considerano "stabili"
 *  (decisione 9: 10 punti sugli score, 10% sui parametri). */
export const SCORE_STABLE_DELTA = 10

// `labelKey` è la chiave in `scores.bands.<scheme>`.
export type Zone = { max: number; labelKey: string; color: string }

// Confini delle fasce (Appendice A del manuale, decisioni 2 e 15):
//   Stress 30/50/70/85; Recupero, Equilibrio, Energia, Adattamento 25/45/65/85.
export const ZONES: Record<GaugeColorScheme, Zone[]> = {
  stress: [
    { max: 30, labelKey: 'low', color: STRESS_SCORE_COLORS[0] },
    { max: 50, labelKey: 'balance', color: STRESS_SCORE_COLORS[1] },
    { max: 70, labelKey: 'medium', color: STRESS_SCORE_COLORS[2] },
    { max: 85, labelKey: 'high', color: STRESS_SCORE_COLORS[3] },
    { max: Infinity, labelKey: 'fatigue', color: STRESS_SCORE_COLORS[4] },
  ],
  recovery: [
    { max: 25, labelKey: 'insufficient', color: POSITIVE_SCORE_COLORS[0] },
    { max: 45, labelKey: 'poor', color: POSITIVE_SCORE_COLORS[1] },
    { max: 65, labelKey: 'moderate', color: POSITIVE_SCORE_COLORS[2] },
    { max: 85, labelKey: 'good', color: POSITIVE_SCORE_COLORS[3] },
    { max: Infinity, labelKey: 'optimal', color: POSITIVE_SCORE_COLORS[4] },
  ],
  balance: [
    { max: 25, labelKey: 'strongImbalance', color: POSITIVE_SCORE_COLORS[0] },
    { max: 45, labelKey: 'moderateImbalance', color: POSITIVE_SCORE_COLORS[1] },
    { max: 65, labelKey: 'sufficient', color: POSITIVE_SCORE_COLORS[2] },
    { max: 85, labelKey: 'good', color: POSITIVE_SCORE_COLORS[3] },
    { max: Infinity, labelKey: 'optimal', color: POSITIVE_SCORE_COLORS[4] },
  ],
  energy: [
    { max: 25, labelKey: 'depleted', color: POSITIVE_SCORE_COLORS[0] },
    { max: 45, labelKey: 'low', color: POSITIVE_SCORE_COLORS[1] },
    { max: 65, labelKey: 'moderate', color: POSITIVE_SCORE_COLORS[2] },
    { max: 85, labelKey: 'good', color: POSITIVE_SCORE_COLORS[3] },
    { max: Infinity, labelKey: 'full', color: POSITIVE_SCORE_COLORS[4] },
  ],
  // Adattamento (score_modulazione_infiammatoria): 25/45/65/85 come gli altri
  // score positivi (decisione 2), etichette invariate.
  adaptation: [
    { max: 25, labelKey: 'fragile', color: POSITIVE_SCORE_COLORS[0] },
    { max: 45, labelKey: 'toImprove', color: POSITIVE_SCORE_COLORS[1] },
    { max: 65, labelKey: 'reduced', color: POSITIVE_SCORE_COLORS[2] },
    { max: 85, labelKey: 'good', color: POSITIVE_SCORE_COLORS[3] },
    { max: Infinity, labelKey: 'excellent', color: POSITIVE_SCORE_COLORS[4] },
  ],
}

/** Schema da usare per lo score composito (Stress Index Score), che nel sito
 *  non ha fasce proprie: scala "positiva" 25/45/65/85 (decisione 16). */
export const COMPOSITE_SCHEME: GaugeColorScheme = 'recovery'

/** Confini interni delle fasce (senza l'ultimo Infinity), per archi e tacche. */
export function zoneBounds(scheme: GaugeColorScheme): number[] {
  return ZONES[scheme].slice(0, -1).map((z) => z.max)
}

/** Verso del "meglio": per lo Stress scendere è meglio, per gli altri salire. */
export function higherIsBetter(scheme: GaugeColorScheme): boolean {
  return scheme !== 'stress'
}

export function zoneFor(scheme: GaugeColorScheme, v: number): Zone {
  const zones = ZONES[scheme]
  return zones.find((z) => v < z.max) ?? zones[zones.length - 1]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/** Chiave della fascia (`scores.bands.<scheme>.<key>`) per un valore 0-100. */
export function gaugeZoneKey(scheme: GaugeColorScheme, value: number): string {
  return zoneFor(scheme, clamp(value)).labelKey
}

/** Alias esplicito di `gaugeZoneKey`: etichetta (chiave i18n) della fascia. */
export function scoreZoneLabel(scheme: GaugeColorScheme, value: number): string {
  return gaugeZoneKey(scheme, value)
}

/** Colore (hex) della fascia di uno score 0-100 nello schema dato. */
export function scoreZoneColor(scheme: GaugeColorScheme, value: number): string {
  return zoneFor(scheme, clamp(value)).color
}

/**
 * Tono della variazione fra due score: 'better' / 'worse' se la differenza
 * supera `SCORE_STABLE_DELTA` nel verso del "meglio" dello schema, altrimenti
 * 'stable'. Per lo Stress un delta negativo è un miglioramento.
 */
export function scoreDeltaTone(scheme: GaugeColorScheme, delta: number): 'better' | 'worse' | 'stable' {
  if (Math.abs(delta) < SCORE_STABLE_DELTA) return 'stable'
  const up = delta > 0
  return up === higherIsBetter(scheme) ? 'better' : 'worse'
}
