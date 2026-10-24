// =============================================================================
// alert_rules — le soglie degli avvisi HRV, condivise con l'app Flutter
// =============================================================================
//
// La tabella è quella dell'app (supabase/migrations/alerts.sql +
// alert_rules_client_override.sql): una riga per (professionista, cliente,
// tipo). `client_id` NULL = regola generale del professionista; una riga con
// `client_id` valorizzato è l'override di quel cliente e SOSTITUISCE la
// generale dello stesso tipo, non si somma — anche quando è disattivata
// (spegnere l'avviso per un singolo cliente deve poter zittire la regola
// generale). È la stessa precedenza di AlertService.resolveForClient nell'app.
//
// Il sito non ricalcola nulla: legge le regole per mostrarle e le scrive dalla
// sezione "Soglie avvisi" della scheda cliente, sulla stessa tabella dell'app.
// Gli eventi generati dall'app (alert_events) si leggono da qui per mostrarli
// in dashboard accanto agli alert del cron.

import type { Tr } from '@/i18n/types'
import { ALERT_TYPE_KEY, type Alert } from './types'

export interface AlertRule {
  id: string
  professionista_id: string
  client_id: string | null
  alert_type: string
  enabled: boolean
  threshold_value: number | null
  created_at: string
}

/** Le 9 regole HRV predefinite, con gli stessi id, default e limiti dell'app
 *  (lib/models/alert.dart, PredefinedAlertType). I default sono quelli unici
 *  di app e cron del sito (decisione 19 del 23/10/2026, Appendice A del
 *  manuale): stress cronico 70, critico 85, recupero 25, SDNN 20, DFA α1 0,75,
 *  FC 90, Adattamento 25, calo RMSSD 20 e 30. L'id `rmssd_drop_40` resta per
 *  compatibilità con le righe già salvate, la soglia predefinita è 30%.
 *  Le regole sport (ACWR, TSB)
 *  dipendono dal carico, non dalla singola misurazione, e non hanno override
 *  per cliente. `titleKey` e `thresholdKey` sono chiavi del namespace `alerts`
 *  (`t = useTranslations('alerts')`; `t(rule.titleKey)`). */
export interface PredefinedAlertRule {
  id: string
  titleKey: string
  thresholdKey: string
  defaultThreshold: number
  suffix: string
  min: number
  max: number
  step: number
  severity: 'medium' | 'high'
}

export const PREDEFINED_ALERT_RULES: PredefinedAlertRule[] = [
  { id: 'rmssd_drop_20', titleKey: 'types.rmssd_drop_20', thresholdKey: 'thresholds.dropFromBaseline', defaultThreshold: 20, suffix: '%', min: 5, max: 50, step: 1, severity: 'medium' },
  { id: 'rmssd_drop_40', titleKey: 'types.rmssd_drop_40', thresholdKey: 'thresholds.dropFromBaseline', defaultThreshold: 30, suffix: '%', min: 20, max: 70, step: 1, severity: 'high' },
  { id: 'stress_high_chronic', titleKey: 'types.stress_high_chronic', thresholdKey: 'thresholds.stressAbove', defaultThreshold: 70, suffix: '', min: 50, max: 95, step: 1, severity: 'medium' },
  { id: 'stress_critical', titleKey: 'types.stress_critical', thresholdKey: 'thresholds.stressAbove', defaultThreshold: 85, suffix: '', min: 70, max: 99, step: 1, severity: 'high' },
  { id: 'recovery_low', titleKey: 'types.recovery_low', thresholdKey: 'thresholds.recoveryBelow', defaultThreshold: 25, suffix: '', min: 10, max: 50, step: 1, severity: 'medium' },
  { id: 'sdnn_low', titleKey: 'types.sdnn_low', thresholdKey: 'thresholds.sdnnBelow', defaultThreshold: 20, suffix: ' ms', min: 5, max: 50, step: 1, severity: 'high' },
  { id: 'dfa_alpha1_abnormal', titleKey: 'types.dfa_alpha1_abnormal', thresholdKey: 'thresholds.dfaBelow', defaultThreshold: 0.75, suffix: '', min: 0.2, max: 1.0, step: 0.05, severity: 'medium' },
  { id: 'hr_rest_high', titleKey: 'types.hr_rest_high', thresholdKey: 'thresholds.hrAbove', defaultThreshold: 90, suffix: ' bpm', min: 60, max: 130, step: 1, severity: 'medium' },
  { id: 'inflammation_drop', titleKey: 'types.inflammation_drop', thresholdKey: 'thresholds.adaptationBelow', defaultThreshold: 25, suffix: '', min: 10, max: 60, step: 1, severity: 'medium' },
]

/** Default delle soglie del cron del sito (colonne di `client_settings`,
 *  `sito-001`/`sito-002`), allineati alle regole dell'app qui sopra e alla
 *  migrazione `sito-050`: Stress 70 (= stress_high_chronic), Recupero,
 *  Equilibrio ed Energia 25 (= recovery_low). Fattore di tolleranza per le
 *  misurazioni mancate: ×1,5 sull'intervallo atteso (come la home). */
export const CRON_ALERT_DEFAULTS = {
  alert_threshold_stress: 70,
  alert_threshold_recovery: 25,
  alert_threshold_balance: 25,
  alert_threshold_energy: 25,
  missedMeasurementFactor: 1.5,
} as const

export const PREDEFINED_ALERT_RULE_BY_ID: Record<string, PredefinedAlertRule> = Object.fromEntries(
  PREDEFINED_ALERT_RULES.map((r) => [r.id, r]),
)

/** Etichetta tradotta di un tipo di avviso, per gli eventi scritti dall'app e
 *  per quelli del cron (che usano altri codici). `t` è il traduttore del
 *  namespace `alerts`; un codice sconosciuto viene mostrato com'è. */
export function alertTypeLabel(type: string, t: Tr): string {
  const pre = PREDEFINED_ALERT_RULE_BY_ID[type]
  if (pre) return t(pre.titleKey)
  const key = ALERT_TYPE_KEY[type]
  return key ? t(key) : type
}

// ── Messaggi degli alert nella lingua del professionista ─────────────────────
//
// La composizione vive in `alert-message.ts` (modulo senza import di valore,
// coperto da `alert-message.test.ts`); qui si riesporta perché i chiamanti
// importano tutto ciò che riguarda gli alert da questo file.
export { alertMessage, alertValueDecimals, type AlertMessageOptions } from './alert-message'

// ── Precedenza (porting 1:1 di AlertService.resolveForClient) ────────────────

/**
 * Regola che vale davvero per [clientId] per ogni tipo: quella specifica del
 * cliente se esiste, altrimenti la generale. A parità di tipo vince la regola
 * del cliente; fra due regole dello stesso livello vince la più recente.
 */
export function resolveRulesForClient(rules: AlertRule[], clientId: string): Map<string, AlertRule> {
  const resolved = new Map<string, AlertRule>()
  for (const r of rules) {
    if (r.client_id != null && r.client_id !== clientId) continue
    const current = resolved.get(r.alert_type)
    if (!current) {
      resolved.set(r.alert_type, r)
      continue
    }
    const currentIsGlobal = current.client_id == null
    const candidateIsClient = r.client_id != null
    if (candidateIsClient && currentIsGlobal) {
      resolved.set(r.alert_type, r)
    } else if (candidateIsClient === !currentIsGlobal && new Date(r.created_at) > new Date(current.created_at)) {
      resolved.set(r.alert_type, r)
    }
  }
  return resolved
}

/** Soglia effettiva per un tipo: override → generale → default dell'app. */
export function effectiveThreshold(resolved: Map<string, AlertRule>, ruleId: string): number {
  return resolved.get(ruleId)?.threshold_value ?? PREDEFINED_ALERT_RULE_BY_ID[ruleId]?.defaultThreshold ?? 0
}

export function effectiveEnabled(resolved: Map<string, AlertRule>, ruleId: string): boolean {
  return resolved.get(ruleId)?.enabled ?? true
}

/** Unione degli alert del cron e degli eventi dell'app, per severità (alta
 *  prima) e poi per data decrescente. */
export function mergeAlerts(cron: Alert[], events: Alert[], limit?: number): Alert[] {
  const rank = { high: 3, medium: 2, low: 1 } as const
  const all = [...cron, ...events].sort((a, b) => {
    const s = rank[b.severity] - rank[a.severity]
    if (s !== 0) return s
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  return limit ? all.slice(0, limit) : all
}
