// Fasce degli score (soglie e colori identici a proprietary_scores.dart
// dell'app). Modulo puro: usato dal tachimetro (client) e dalle pagine di
// stampa (server), che non possono importare funzioni da un modulo 'use client'.

export type GaugeColorScheme = 'stress' | 'recovery' | 'balance' | 'energy' | 'adaptation'

// Palette allineata ad AppColors dell'app
export const GREEN = '#2F8F6B' // AppColors.success
export const YELLOW = '#C78A2C' // AppColors.warning
export const ORANGE = '#E67E22'
export const RED = '#C44E4E' // AppColors.error
export const DARK_RED = '#A93226'

// `labelKey` è la chiave in `scores.bands.<scheme>`.
export type Zone = { max: number; labelKey: string; color: string }

// Soglie identiche a proprietary_scores.dart (_stressZone, _recoveryZone, ...)
export const ZONES: Record<GaugeColorScheme, Zone[]> = {
  stress: [
    { max: 30, labelKey: 'low', color: GREEN },
    { max: 50, labelKey: 'balance', color: YELLOW },
    { max: 70, labelKey: 'medium', color: ORANGE },
    { max: 85, labelKey: 'high', color: RED },
    { max: Infinity, labelKey: 'fatigue', color: DARK_RED },
  ],
  recovery: [
    { max: 25, labelKey: 'insufficient', color: RED },
    { max: 45, labelKey: 'poor', color: ORANGE },
    { max: 65, labelKey: 'moderate', color: YELLOW },
    { max: 85, labelKey: 'good', color: GREEN },
    { max: Infinity, labelKey: 'optimal', color: GREEN },
  ],
  balance: [
    { max: 25, labelKey: 'strongImbalance', color: RED },
    { max: 45, labelKey: 'moderateImbalance', color: ORANGE },
    { max: 65, labelKey: 'sufficient', color: YELLOW },
    { max: 85, labelKey: 'good', color: GREEN },
    { max: Infinity, labelKey: 'optimal', color: GREEN },
  ],
  energy: [
    { max: 25, labelKey: 'depleted', color: RED },
    { max: 45, labelKey: 'low', color: ORANGE },
    { max: 65, labelKey: 'moderate', color: YELLOW },
    { max: 85, labelKey: 'good', color: GREEN },
    { max: Infinity, labelKey: 'full', color: GREEN },
  ],
  adaptation: [
    { max: 20, labelKey: 'fragile', color: RED },
    { max: 40, labelKey: 'toImprove', color: ORANGE },
    { max: 60, labelKey: 'reduced', color: YELLOW },
    { max: 80, labelKey: 'good', color: GREEN },
    { max: Infinity, labelKey: 'excellent', color: GREEN },
  ],
}


export function zoneFor(scheme: GaugeColorScheme, v: number): Zone {
  const zones = ZONES[scheme]
  return zones.find((z) => v < z.max) ?? zones[zones.length - 1]
}

/** Chiave della fascia (`scores.bands.<scheme>.<key>`) per un valore 0-100. */
export function gaugeZoneKey(scheme: GaugeColorScheme, value: number): string {
  return zoneFor(scheme, Math.max(0, Math.min(100, value))).labelKey
}
