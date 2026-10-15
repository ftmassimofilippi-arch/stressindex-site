// =============================================================================
// Messaggi degli alert nella lingua del professionista
// =============================================================================
//
// Modulo "puro", senza import di valore (solo tipi): lo usano pagine server,
// client component e route API, e `alert-message.test.ts` lo importa con
// node --test. Viene riesportato da `alert-rules.ts`, da cui i chiamanti
// continuano a importare `alertMessage`.
//
// Due famiglie di alert arrivano al sito già scritte da altri:
//
// 1. Gli eventi dell'app (`alert_events`, `source: 'app'`): `message` è
//    formattato nella lingua del telefono del cliente ("Doretta has an SDNN of
//    21.5 ms…"). Il sito non può tradurre quel testo, ma per le regole
//    predefinite conosce il modello (setAlertMsg* negli ARB dell'app) e quindi
//    la posizione dei numeri: li estrae e ricompone la frase dai messaggi del
//    sito. Se i numeri non tornano si mostra il testo dell'app.
//
// 2. Gli alert del cron del sito (`alerts`, sito-002): `message` è italiano
//    fisso ("Indice di Stress elevato: 85.2 (soglia 80)"), ma `triggering_metric`
//    e `triggering_value` bastano a ricomporre "{indice}: {valore}" nella lingua
//    della pagina. `missed_measurement` non ha valore: si rilegge la data dal
//    testo ("Ultima misurazione: 07/10/2026 (oltre 14 giorni)").

import type { Tr } from '@/i18n/types'

/** Campi di `Alert` (src/lib/types.ts) che servono a comporre la riga. */
export type AlertMessageInput = {
  type: string
  message?: string | null
  triggering_value?: number | null
  triggering_metric?: string | null
  source?: 'app' | 'cron'
}

export type AlertMessageOptions = {
  /** Traduttore del namespace `scores`: dà il nome dell'indice agli alert del
   *  cron (`names.stress`, `names.recovery`, …). Senza, resta "valore {n}". */
  tScores?: Tr
  /** Data nella lingua della pagina, per `missed_measurement`
   *  (es. `(d) => formatDate(d, undefined, locale)`). Senza, resta GG/MM/AAAA. */
  fmtDate?: (d: Date) => string
}

/** Numeri che ogni modello di messaggio dell'app contiene, nell'ordine in cui
 *  compaiono, e chiave del messaggio del sito (namespace `alerts.messages`). */
const APP_MESSAGE_TEMPLATES: Record<string, { key: string; params: string[]; strip?: RegExp }> = {
  rmssd_drop_20: { key: 'rmssdDrop', params: ['rmssd', 'drop', 'baseline'] },
  rmssd_drop_40: { key: 'rmssdDrop', params: ['rmssd', 'drop', 'baseline'] },
  stress_high_chronic: { key: 'stressChronic', params: ['threshold'] },
  stress_critical: { key: 'stressCritical', params: ['value'] },
  recovery_low: { key: 'recoveryLow', params: ['value'] },
  sdnn_low: { key: 'sdnnLow', params: ['value'] },
  // "DFA Alpha1" contiene una cifra: va tolta prima di leggere i numeri.
  dfa_alpha1_abnormal: { key: 'dfaAbnormal', params: ['value', 'threshold'], strip: /alpha\s?1|α1/gi },
  hr_rest_high: { key: 'hrRestHigh', params: ['value', 'threshold'] },
  inflammation_drop: { key: 'adaptationDrop', params: ['value'] },
  acwr_warning: { key: 'acwr', params: ['acwr'] },
  acwr_danger: { key: 'acwr', params: ['acwr'] },
  acwr_danger_hrv: { key: 'acwrHrv', params: ['acwr'] },
  undertraining: { key: 'acwr', params: ['acwr'] },
  tsb_peak: { key: 'tsb', params: ['tsb'] },
}

/** Colonna di `measurement_analytics` scritta dal cron in `triggering_metric`
 *  → chiave di `scores.names`. */
export const SCORE_METRIC_NAME_KEY: Record<string, string> = {
  score_stress: 'stress',
  score_recupero: 'recovery',
  score_equilibrio: 'balance',
  score_energia: 'energy',
  score_modulazione_infiammatoria: 'adaptation',
}

function numbersIn(text: string): number[] {
  return (text.match(/-?\d+(?:[.,]\d+)?/g) ?? [])
    .map((s) => Number(s.replace(',', '.')))
    .filter((n) => Number.isFinite(n))
}

/** Decimali da conservare per un valore estratto da un alert: quelli che ha
 *  (0.45 → 2, 32 → 0), al massimo due. */
export function alertValueDecimals(v: number): number {
  const s = String(v)
  const i = s.indexOf('.')
  return i < 0 ? 0 : Math.min(2, s.length - i - 1)
}

const MISSED_DATE = /(\d{2})\/(\d{2})\/(\d{4})/
const MISSED_DAYS = /\((?:oltre|over|über)\s+(\d+)/i
const NEVER_MEASURED = /mai misurato|never measured|nie gemessen/i

function missedMeasurementMessage(raw: string, t: Tr, fmt: (v: number) => string, opts: AlertMessageOptions): string {
  if (NEVER_MEASURED.test(raw)) return t('messages.neverMeasured')
  const m = raw.match(MISSED_DATE)
  if (!m) return raw
  const [, dd, mm, yyyy] = m
  const date = opts.fmtDate ? opts.fmtDate(new Date(Number(yyyy), Number(mm) - 1, Number(dd))) : m[0]
  const days = raw.match(MISSED_DAYS)
  if (days) return t('messages.missedSince', { date, days: fmt(Number(days[1])) })
  return t('messages.missedOn', { date })
}

/**
 * Riga descrittiva di un alert, tradotta: per gli eventi dell'app ricompone la
 * frase della regola con i valori misurati; per gli alert del cron mostra
 * l'indice e il valore scatenante. Vuota se non c'è nulla da dire oltre al
 * titolo. `t` è il traduttore del namespace `alerts`; `fmt` formatta i numeri
 * nella lingua della pagina (es. `(v) => num(v, alertValueDecimals(v), locale)`).
 */
export function alertMessage(alert: AlertMessageInput, t: Tr, fmt: (v: number) => string, opts: AlertMessageOptions = {}): string {
  const raw = alert.message ?? ''
  if (alert.source === 'app') {
    const tpl = APP_MESSAGE_TEMPLATES[alert.type]
    if (tpl && raw) {
      const nums = numbersIn(tpl.strip ? raw.replace(tpl.strip, '') : raw)
      if (nums.length >= tpl.params.length) {
        const values: Record<string, string> = {}
        tpl.params.forEach((p, i) => { values[p] = fmt(nums[i]) })
        return t(`messages.${tpl.key}`, values)
      }
    }
    return raw
  }
  if (alert.type === 'missed_measurement') return missedMeasurementMessage(raw, t, fmt, opts)
  if (alert.triggering_value != null) {
    const value = fmt(alert.triggering_value)
    const nameKey = alert.triggering_metric ? SCORE_METRIC_NAME_KEY[alert.triggering_metric] : undefined
    if (nameKey && opts.tScores) return `${opts.tScores(`names.${nameKey}`)}: ${value}`
    return t('messages.value', { value })
  }
  return raw
}
