import type { PostgrestError } from '@supabase/supabase-js'

// =============================================================================
// Select resiliente alle colonne mancanti
// =============================================================================
//
// Il DB e il codice non vengono deployati insieme: una colonna aggiunta al sito
// ma non ancora al database (o rimossa dal database) fa fallire l'INTERA query
// con 42703, non solo quella colonna. Effetto reale in produzione: una singola
// `sessions.orthostatic_data` mancante ha azzerato le misurazioni di TUTTI i
// clienti, perché listMeasurementsForClient non riceveva più nessuna riga.
//
// Stesso hardening che l'app Flutter ha già in _upsertRow: se il DB dice che
// una colonna non esiste, la si toglie e si riprova. Si perde quel singolo
// campo (null nel risultato), non la pagina.
//
// PostgREST segnala UNA colonna per volta:
//   { code: '42703', message: 'column sessions.orthostatic_data does not exist' }
// quindi il retry è iterativo: due colonne mancanti = due giri.

const UNDEFINED_COLUMN = '42703'

// Estrae il nome di colonna da entrambe le forme usate da PostgreSQL:
//   column sessions.orthostatic_data does not exist
//   column "orthostatic_data" does not exist
export function parseMissingColumn(message: string | null | undefined): string | null {
  if (!message) return null
  const m = /column\s+"?(?:[a-zA-Z0-9_]+"?\."?)?([a-zA-Z0-9_]+)"?\s+does not exist/i.exec(message)
  return m ? m[1] : null
}

type SelectResult<T> = { data: T[] | null; error: PostgrestError | null }

export type ResilientResult<T> = SelectResult<T> & {
  /** Colonne escluse perché assenti nel database (già loggate). */
  missing: string[]
}

// `run` riceve la lista colonne come stringa e deve restituire la query eseguita:
//
//   const { data, missing } = await selectWithMissingColumnFallback(
//     SESSION_COLUMNS,
//     (cols) => supabase.from('sessions').select(cols).eq('client_id', id),
//     { label: 'sessions', required: ['id'] },
//   )
//
// `required`: colonne senza le quali il risultato è inutilizzabile (di norma le
// chiavi). Se una di queste manca non si degrada in silenzio: si restituisce
// l'errore, così il problema resta visibile invece di produrre righe monche.
export async function selectWithMissingColumnFallback<T>(
  columns: readonly string[],
  run: (columns: string) => PromiseLike<SelectResult<T>>,
  opts?: { label?: string; required?: readonly string[] },
): Promise<ResilientResult<T>> {
  const label = opts?.label ?? 'query'
  const required = new Set(opts?.required ?? [])
  const missing: string[] = []
  let cols = columns.filter((c) => c.trim().length > 0)

  // Al massimo un giro per colonna: il ciclo non può essere infinito perché
  // ogni iterazione rimuove una colonna dalla lista.
  for (let attempt = 0; attempt <= columns.length; attempt++) {
    const res = await run(cols.join(', '))
    if (!res.error || res.error.code !== UNDEFINED_COLUMN) {
      return { ...res, missing }
    }
    const col = parseMissingColumn(res.error.message)
    if (!col || !cols.includes(col) || required.has(col)) {
      console.error(`[safe-select] ${label}: colonna mancante non recuperabile`, {
        column: col,
        required: col ? required.has(col) : false,
        error: res.error,
      })
      return { ...res, missing }
    }
    console.warn(
      `[safe-select] ${label}: la colonna "${col}" non esiste nel database, la escludo e riprovo. ` +
        'Allineare lo schema (migration mancante) per non perdere il dato.',
    )
    missing.push(col)
    cols = cols.filter((c) => c !== col)
    if (cols.length === 0) return { data: [], error: null, missing }
  }
  return { data: [], error: null, missing }
}
