// Regole del modulo Sport che decidono quali sessioni entrano nelle
// statistiche. Modulo puro, senza import: lo usano sport-data.ts (server), le
// pagine e i componenti client, e i test (`node --test`).
//
// Una sessione di 29 secondi o di un minuto e mezzo è quasi sempre un avvio
// per sbaglio o una prova del sensore: TRIMP 0, DFA α1 senza finestre. Contata
// nelle statistiche abbassa il TRIMP medio e gonfia il numero di sessioni.
// Resta visibile nell'elenco, con il badge "Troppo breve".

/** Durata minima (secondi) di una sessione che entra in statistiche e grafici. */
export const SPORT_MIN_DURATION_S = 300

/**
 * true se la sessione conta nelle statistiche. Senza durata registrata la
 * sessione si tiene: non c'è prova che sia troppo breve.
 */
export function isSportSessionValida(s: { duration_s?: number | null }): boolean {
  const d = s.duration_s
  if (d == null || !Number.isFinite(d)) return true
  return d >= SPORT_MIN_DURATION_S
}
