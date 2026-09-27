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

import type { Alert } from './types'

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
 *  (lib/models/alert.dart, PredefinedAlertType). Le regole sport (ACWR, TSB)
 *  dipendono dal carico, non dalla singola misurazione, e non hanno override
 *  per cliente. */
export interface PredefinedAlertRule {
  id: string
  title: string
  thresholdLabel: string
  defaultThreshold: number
  suffix: string
  min: number
  max: number
  step: number
  severity: 'medium' | 'high'
}

export const PREDEFINED_ALERT_RULES: PredefinedAlertRule[] = [
  { id: 'rmssd_drop_20', title: 'Calo significativo RMSSD', thresholdLabel: 'Calo rispetto alla baseline', defaultThreshold: 20, suffix: '%', min: 5, max: 50, step: 1, severity: 'medium' },
  { id: 'rmssd_drop_40', title: 'Calo importante RMSSD', thresholdLabel: 'Calo rispetto alla baseline', defaultThreshold: 40, suffix: '%', min: 20, max: 70, step: 1, severity: 'high' },
  { id: 'stress_high_chronic', title: 'Stress elevato persistente', thresholdLabel: 'Stress Index superiore a', defaultThreshold: 75, suffix: '', min: 50, max: 95, step: 1, severity: 'medium' },
  { id: 'stress_critical', title: 'Stress critico', thresholdLabel: 'Stress Index superiore a', defaultThreshold: 85, suffix: '', min: 70, max: 99, step: 1, severity: 'high' },
  { id: 'recovery_low', title: 'Recupero insufficiente', thresholdLabel: 'Recovery inferiore a', defaultThreshold: 30, suffix: '', min: 10, max: 50, step: 1, severity: 'medium' },
  { id: 'sdnn_low', title: 'SDNN molto basso', thresholdLabel: 'SDNN inferiore a', defaultThreshold: 20, suffix: ' ms', min: 5, max: 50, step: 1, severity: 'high' },
  { id: 'dfa_alpha1_abnormal', title: 'Variabilità del battito in calo', thresholdLabel: 'DFA α1 inferiore a', defaultThreshold: 0.5, suffix: '', min: 0.2, max: 1.0, step: 0.05, severity: 'medium' },
  { id: 'hr_rest_high', title: 'Battito a riposo elevato', thresholdLabel: 'HR superiore a', defaultThreshold: 90, suffix: ' bpm', min: 60, max: 130, step: 1, severity: 'medium' },
  { id: 'inflammation_drop', title: 'Adattamento basso', thresholdLabel: 'Score Adattamento inferiore a', defaultThreshold: 30, suffix: '', min: 10, max: 60, step: 1, severity: 'medium' },
]

export const PREDEFINED_ALERT_RULE_BY_ID: Record<string, PredefinedAlertRule> = Object.fromEntries(
  PREDEFINED_ALERT_RULES.map((r) => [r.id, r]),
)

/** Etichetta italiana di un tipo di avviso, per gli eventi scritti dall'app e
 *  per quelli del cron (che usano altri codici). */
export function alertTypeLabel(type: string): string {
  const pre = PREDEFINED_ALERT_RULE_BY_ID[type]
  if (pre) return pre.title
  const cron: Record<string, string> = {
    high_stress: 'Stress elevato',
    low_recovery: 'Recupero basso',
    missed_measurement: 'Misurazione mancante',
    abnormal_value: 'Valore anomalo',
    trend_negative: 'Trend negativo',
    acwr_warning: 'Carico in aumento rapido',
    acwr_danger: 'Rischio infortunio: carico',
    acwr_danger_hrv: 'Rischio infortunio: carico e HRV',
    undertraining: 'Carico troppo basso',
    tsb_peak: 'Forma al picco',
  }
  return cron[type] ?? type
}

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
