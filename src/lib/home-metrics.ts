// =============================================================================
// Numeri delle card della home dell'area professionisti (QA C6.d, C8)
// =============================================================================
//
// Conteggi puri sui dati già letti da `dashboard-data.ts`: niente Supabase,
// niente next/headers, così `home-metrics.test.ts` li esegue con node --test.
// La lettura delle righe sta in `dashboard-data.ts` (`trendMisurazioniMensile`).

/** Schede con `last_measurement_at` negli ultimi `giorni` giorni. */
export function clientiAttivi(
  clients: Array<{ last_measurement_at?: string | null }>,
  giorni = 90,
  now: Date = new Date(),
): number {
  const soglia = now.getTime() - giorni * 86_400_000
  let n = 0
  for (const c of clients) {
    if (!c.last_measurement_at) continue
    const t = new Date(c.last_measurement_at).getTime()
    if (Number.isFinite(t) && t >= soglia && t <= now.getTime() + 86_400_000) n++
  }
  return n
}

export type TrendMensile = {
  /** Misurazioni negli ultimi 30 giorni italiani (oggi compreso). */
  correnti: number
  /** Misurazioni nei 30 giorni precedenti. */
  precedenti: number
  /** Variazione percentuale, `null` quando il mese precedente è a zero. */
  variazione: number | null
}

/** Variazione percentuale di `corrente` rispetto a `precedente`; `null` se il denominatore è 0. */
export function variazionePercentuale(corrente: number, precedente: number): number | null {
  if (precedente <= 0) return null
  return ((corrente - precedente) / precedente) * 100
}

/**
 * Conta le misurazioni nelle due finestre di 30 giorni a partire dalle chiavi
 * giorno (`YYYY-MM-DD`, giornata italiana). `giorni` è la lista dei 60 giorni
 * dal più vecchio a oggi, come la produce chi conosce il calendario italiano
 * (`giornoItaFa(59..0)`): la funzione non ha bisogno di sapere che giorno è.
 */
export function trendMensileDaGiorni(chiaviGiorno: Array<string | null>, giorni: string[]): TrendMensile {
  const meta = Math.floor(giorni.length / 2)
  const precedentiSet = new Set(giorni.slice(0, meta))
  const correntiSet = new Set(giorni.slice(meta))
  let correnti = 0
  let precedenti = 0
  for (const k of chiaviGiorno) {
    if (!k) continue
    if (correntiSet.has(k)) correnti++
    else if (precedentiSet.has(k)) precedenti++
  }
  return { correnti, precedenti, variazione: variazionePercentuale(correnti, precedenti) }
}
