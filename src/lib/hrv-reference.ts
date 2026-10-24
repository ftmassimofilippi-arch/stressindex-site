// =============================================================================
// Riferimenti HRV del sito: range dei parametri, semaforo, soglie condivise
// =============================================================================
//
// Unica fonte dei numeri di riferimento del sito. I valori vengono
// dall'Appendice A del manuale, come riassunta in DECISIONI.md del 23/10/2026
// (decisioni 3-7, 9-14 e l'elenco dei range generici). Ogni numero è fissato
// da `hrv-reference.test.ts`: se cambia il manuale, cambia qui e nel test.
//
// Modulo puro: nessun import da next, da React o da `@/` (lo eseguono anche i
// test con `node --test`). Lo riesporta `hrv-reference-ranges.ts` (facciata
// per gli import esistenti di HrvParamsTable, ParamsSummaryCard e delle pagine
// di stampa).
//
// Chiavi = colonne di `measurement_analytics` (le stesse di HrvParamsTable):
// per le bande spettrali `vlf_power`, `lf_power`, `hf_power` (solo Welch, le
// colonne `_ls` di Lomb non hanno semaforo).

export type ReferenceRange = [number, number]

/**
 * Forma del parametro:
 *   - 'higherBetter': sopra il range resta verde ("alto = bene", salvo un
 *     `yellowHigh` esplicito), sotto giallo poi rosso;
 *   - 'lowerBetter': sotto il range resta verde (salvo un `yellowLow`
 *     esplicito, come per la FC media), sopra giallo poi rosso;
 *   - 'bell': giallo poi rosso su entrambi i lati;
 *   - 'none': nessun semaforo (il range, se c'è, è solo orientativo).
 */
export type ReferenceShape = 'higherBetter' | 'lowerBetter' | 'bell' | 'none'

export type ParamReference = {
  range: ReferenceRange
  shape: ReferenceShape
  /** Sotto questo valore è rosso (fra `yellowLow` e `range[0]` giallo). Default: decisione 13. */
  yellowLow?: number
  /** Sopra questo valore è rosso (fra `range[1]` e `yellowHigh` giallo). Default: decisione 13. */
  yellowHigh?: number
  unit: string
  manual: 'Appendice A'
}

/** Decisione 13: oltre il bordo, giallo entro il 20% dell'ampiezza del range, rosso oltre. */
export const EDGE_TOLERANCE = 0.2

const A = 'Appendice A' as const

export const PARAM_REFERENCE: Record<string, ParamReference> = {
  // ── Dominio del tempo ──────────────────────────────────────────────────────
  // Decisione 7: 50-70 verde, 70-80 giallo, >80 rosso; 45-50 giallo (atleti),
  // <45 rosso. Verso "più basso = meglio" nei confronti, ma con soglie
  // esplicite anche sotto.
  mean_hr: { range: [50, 70], shape: 'lowerBetter', yellowLow: 45, yellowHigh: 80, unit: 'bpm', manual: A },
  // Eccezione del manuale: SDNN <20 rosso (20-30 giallo).
  sdnn: { range: [30, 50], shape: 'higherBetter', yellowLow: 20, unit: 'ms', manual: A },
  // Eccezione del manuale: RMSSD <20 rosso (20-30 giallo).
  rmssd: { range: [30, 60], shape: 'higherBetter', yellowLow: 20, unit: 'ms', manual: A },
  // Eccezione del manuale: pNN50 <3 rosso.
  pnn50: { range: [5, 25], shape: 'higherBetter', yellowLow: 3, unit: '%', manual: A },
  // Eccezione del manuale: pNN20 <20 rosso.
  pnn20: { range: [30, 60], shape: 'higherBetter', yellowLow: 20, unit: '%', manual: A },
  // Decisione 5: 4-8 verde, >8 verde, 3-4 giallo, <3 rosso.
  cv: { range: [4, 8], shape: 'higherBetter', yellowLow: 3, unit: '%', manual: A },
  // Decisione 11: 0,5-0,9 verde, 0,4-0,5 e 0,9-1,0 giallo, fuori rosso.
  rmssd_sdnn_ratio: { range: [0.5, 0.9], shape: 'bell', yellowLow: 0.4, yellowHigh: 1.0, unit: '', manual: A },

  // ── Dominio della frequenza (Welch) ────────────────────────────────────────
  // Eccezione del manuale: VLF <200 giallo (mai rosso sotto).
  vlf_power: { range: [200, 2000], shape: 'higherBetter', yellowLow: 0, unit: 'ms²', manual: A },
  lf_power: { range: [500, 2000], shape: 'higherBetter', unit: 'ms²', manual: A },
  hf_power: { range: [300, 1500], shape: 'higherBetter', unit: 'ms²', manual: A },
  // Eccezione del manuale: Total Power <1000 rosso.
  total_power: { range: [1500, 5000], shape: 'higherBetter', yellowLow: 1000, unit: 'ms²', manual: A },
  // Decisione 12: nessun semaforo e nessuna direzione, "0,5-2,0 (orientativo)".
  lf_hf_ratio: { range: [0.5, 2.0], shape: 'none', unit: '', manual: A },
  // Eccezione del manuale: LF norm >70 rosso (60-70 giallo); a campana (decisione 13).
  lf_nu: { range: [30, 60], shape: 'bell', yellowHigh: 70, unit: 'n.u.', manual: A },
  // HF norm: sopra = bene, <20 rosso (20-25 giallo).
  hf_nu: { range: [25, 50], shape: 'higherBetter', yellowLow: 20, unit: 'n.u.', manual: A },

  // ── Non lineari ────────────────────────────────────────────────────────────
  sd1: { range: [20, 50], shape: 'higherBetter', unit: 'ms', manual: A },
  sd2: { range: [40, 100], shape: 'higherBetter', unit: 'ms', manual: A },
  sd1_sd2_ratio: { range: [0.3, 0.6], shape: 'bell', unit: '', manual: A },
  // Decisione 3: 0,85-1,15 verde, 0,75-0,85 e 1,15-1,20 giallo, <0,75 e >1,20 rosso.
  dfa_alpha1: { range: [0.85, 1.15], shape: 'bell', yellowLow: 0.75, yellowHigh: 1.2, unit: '', manual: A },
  dfa_alpha2: { range: [0.95, 1.1], shape: 'bell', unit: '', manual: A },
  // Decisione 6: verde dentro, giallo fuori, mai rosso sopra, rosso sotto 0,5.
  sample_entropy: { range: [1.0, 2.0], shape: 'bell', yellowLow: 0.5, yellowHigh: Infinity, unit: '', manual: A },
  approximate_entropy: { range: [0.8, 1.5], shape: 'bell', yellowLow: 0.5, yellowHigh: Infinity, unit: '', manual: A },

  // ── Geometrici ─────────────────────────────────────────────────────────────
  triangular_index: { range: [15, 40], shape: 'higherBetter', unit: '', manual: A },
  tinn: { range: [100, 300], shape: 'higherBetter', unit: 'ms', manual: A },
  // Decisione 4: 50-150 verde, 150-200 giallo, >200 rosso; sotto 50 verde.
  stress_index_baevsky: { range: [50, 150], shape: 'lowerBetter', yellowHigh: 200, unit: '', manual: A },
}

/** Parametri mostrati senza semaforo né range (decisione 14: LF/VLF grigio). */
export const PARAMS_WITHOUT_REFERENCE: ReadonlySet<string> = new Set(['lf_vlf_ratio'])

/**
 * 'in'   dentro l'intervallo (o oltre il bordo "buono" per higherBetter / lowerBetter)
 * 'edge' giallo: oltre il bordo entro la tolleranza
 * 'out'  rosso: oltre la tolleranza
 * 'none' valore assente, parametro senza semaforo o senza riferimento
 */
export type RangeStatus = 'in' | 'edge' | 'out' | 'none'

function toNum(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Semaforo di un valore. Con `personalRange` (p25-p75 di `hrv_norms`, solo
 * RMSSD e SDNN, decisione 1) si usa quel range al posto del generico, con la
 * stessa forma del parametro e la tolleranza della decisione 13 (le soglie
 * esplicite del manuale valgono solo per il range generico).
 */
export function rangeStatus(value: unknown, key: string, personalRange?: ReferenceRange | null): RangeStatus {
  const v = toNum(value)
  const ref = PARAM_REFERENCE[key]
  if (v == null || !ref || ref.shape === 'none') return 'none'
  const range = personalRange ?? ref.range
  const [lo, hi] = range
  const tol = (hi - lo) * EDGE_TOLERANCE
  const yellowLow = personalRange ? lo - tol : ref.yellowLow ?? lo - tol
  const yellowHigh = personalRange ? hi + tol : ref.yellowHigh ?? hi + tol

  if (v >= lo && v <= hi) return 'in'
  if (v < lo) {
    if (ref.shape === 'lowerBetter' && (personalRange || ref.yellowLow == null)) return 'in'
    return v >= yellowLow ? 'edge' : 'out'
  }
  if (ref.shape === 'higherBetter' && (personalRange || ref.yellowHigh == null)) return 'in'
  return v <= yellowHigh ? 'edge' : 'out'
}

/** Il range mostrato per un parametro (personale se c'è), `null` senza riferimento. */
export function referenceRange(key: string, personalRange?: ReferenceRange | null): ReferenceRange | null {
  if (personalRange) return personalRange
  return PARAM_REFERENCE[key]?.range ?? null
}

/** Vero per i parametri che hanno un range ma nessun semaforo (LF/HF: "orientativo"). */
export function isIndicativeOnly(key: string): boolean {
  return PARAM_REFERENCE[key]?.shape === 'none'
}

/**
 * Testo "lo–hi" del range (personale se c'è). `format` serve per la lingua
 * (Intl.NumberFormat); senza, i numeri escono così come sono.
 */
export function referenceRangeText(
  key: string,
  personalRange?: ReferenceRange | null,
  format: (n: number) => string = (n) => String(n),
): string | null {
  const r = referenceRange(key, personalRange)
  if (!r) return null
  return `${format(r[0])}–${format(r[1])}`
}

/** Tabella generica dei soli range, con sopra i personali: per chi mostra i bordi. */
export function withPersonalRanges(personal?: Record<string, ReferenceRange> | null): Record<string, ReferenceRange> {
  const out: Record<string, ReferenceRange> = {}
  for (const [k, ref] of Object.entries(PARAM_REFERENCE)) out[k] = ref.range
  return personal ? { ...out, ...personal } : out
}

export type ParamsSummary = {
  /** parametri dentro l'intervallo */
  inRange: number
  /** parametri fuori dall'intervallo (oltre la tolleranza) */
  outOfRange: number
  /** parametri al limite (entro la tolleranza) */
  edge: number
  /** parametri valutati: con un valore e un semaforo (LF/HF e LF/VLF non contano) */
  total: number
}

/** Conteggio dei parametri della misurazione rispetto al semaforo. */
export function paramsSummary(
  measurement: Record<string, unknown>,
  personal?: Record<string, ReferenceRange> | null,
): ParamsSummary {
  const out: ParamsSummary = { inRange: 0, outOfRange: 0, edge: 0, total: 0 }
  for (const key of Object.keys(PARAM_REFERENCE)) {
    const status = rangeStatus(measurement[key], key, personal?.[key] ?? null)
    if (status === 'none') continue
    out.total++
    if (status === 'in') out.inRange++
    else if (status === 'edge') out.edge++
    else out.outOfRange++
  }
  return out
}

// ── Soglie condivise ─────────────────────────────────────────────────────────

/** Decisione 9: "stabile" sotto 10 punti sugli score e sotto il 10% sui parametri, ovunque. */
export const STABLE_DELTA = { score: 10, paramPct: 10 } as const

/** Artefatti: sotto il 5% nessun avviso, 5-15% utilizzabile con cautela, oltre si ripete. */
export const QUALITY_BANDS = { silent: 5, warn: 15 } as const

/**
 * Test ortostatico (decisione 10): risposte attese nel passaggio supino → in
 * piedi. FC +10-30 bpm, RMSSD -30-70% (eccessivo oltre il 75%), indice di
 * reattività: ridotto sotto 40, moderato 40-70, ottimale da 70.
 */
export const ORTHO = {
  hrMin: 10,
  hrMax: 30,
  rmssdDropMin: 30,
  rmssdDropMax: 70,
  rmssdDropExcess: 75,
  reactivity: [40, 70] as const,
} as const
