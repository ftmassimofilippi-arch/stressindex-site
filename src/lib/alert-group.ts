// =============================================================================
// Raggruppamento degli alert identici (QA C6.b)
// =============================================================================
//
// Il cron del sito e l'app possono scrivere lo stesso alert più volte (stesso
// cliente, stesso tipo, stesso valore): in home e nella scheda si mostrava una
// riga per ognuno, e tre "Stress critico 91" uguali nascondevano gli altri.
// Qui si riducono a una riga sola, quella più recente, con il numero di
// ripetizioni. Modulo puro: nessun import di valore, eseguibile da node --test.

import type { Alert } from './types'

export type AlertGruppo = {
  /** L'alert più recente del gruppo: è quello che si mostra. */
  alert: Alert
  /** Quanti alert identici rappresenta (1 = nessun doppione). */
  count: number
  /** Gli id di tutti gli alert del gruppo, per eventuali azioni di massa. */
  ids: string[]
}

/** Arrotonda a due decimali: 42.004 e 42.001 sono lo stesso valore. */
function valoreChiave(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2)
}

/**
 * Chiave di identità di un alert. Con un valore scatenante: cliente, tipo,
 * metrica e valore arrotondato a due decimali. Senza valore (misurazione
 * mancante, eventi dell'app): cliente, tipo e testo del messaggio.
 */
export function chiaveAlert(a: Pick<Alert, 'client_id' | 'type' | 'triggering_metric' | 'triggering_value' | 'message' | 'source'>): string {
  const base = `${a.source ?? 'cron'}|${a.client_id}|${a.type}`
  if (a.triggering_value != null && Number.isFinite(a.triggering_value)) {
    return `${base}|${a.triggering_metric ?? ''}|${valoreChiave(a.triggering_value)}`
  }
  return `${base}|msg:${(a.message ?? '').trim()}`
}

/**
 * Raggruppa gli alert identici. Ogni gruppo è rappresentato dal suo alert più
 * recente (per `created_at`); l'ordine dei gruppi è quello in cui il loro
 * rappresentante compare nella lista d'ingresso, così una lista già ordinata
 * per severità e data resta ordinata.
 */
export function raggruppaAlert(alerts: Alert[]): AlertGruppo[] {
  const gruppi = new Map<string, AlertGruppo & { posizione: number }>()
  alerts.forEach((a, i) => {
    const k = chiaveAlert(a)
    const g = gruppi.get(k)
    if (!g) {
      gruppi.set(k, { alert: a, count: 1, ids: [a.id], posizione: i })
      return
    }
    g.count++
    g.ids.push(a.id)
    if (new Date(a.created_at).getTime() > new Date(g.alert.created_at).getTime()) {
      g.alert = a
      g.posizione = i
    }
  })
  return Array.from(gruppi.values())
    .sort((a, b) => a.posizione - b.posizione)
    .map(({ alert, count, ids }) => ({ alert, count, ids }))
}
