// Biofeedback: lettura di sessioni e valutazioni (app-060) e delle
// assegnazioni (programma_attivita, app-064) per la scheda cliente, con la sessione dell'utente (RLS) e il perimetro esplicito.
//
// Le sessioni e le valutazioni seguono la persona misurata (`user_id`): per
// una scheda si prendono le righe con `client_id` = scheda, oppure
// `user_id` = account collegato alla scheda; in ogni caso solo righe nel
// perimetro del professionista (lui stesso o un suo cliente collegato). Le
// assegnazioni: quelle del professionista per quell'account.
//
// Finché la app-060 non è applicata le tabelle non esistono: si risponde con
// liste vuote e `tabelleAssenti`, senza errori in pagina.
import { createClient } from './supabase-server'
import { reportDataError } from './data-error'
import { perimetroProfessionista } from './perimetro-server'
import { nelPerimetro } from './perimetro'
import {
  BIOFEEDBACK_VUOTO,
  parseBiofeedbackAssignment,
  parseBiofeedbackSession,
  parseResonanceAssessment,
  type BiofeedbackAssignment,
  type BiofeedbackScheda,
  type BiofeedbackSession,
  type ResonanceAssessment,
} from './biofeedback'

export { BIOFEEDBACK_VUOTO, type BiofeedbackScheda }

type Raw = Record<string, unknown>
type Risposta = { data: Raw[] | null; error: { code?: string; message?: string } | null }

function tabellaAssente(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  // 42P01 = relazione inesistente; PostgREST risponde anche con PGRST205
  // ("Could not find the table") quando la tabella non è nella cache.
  return e.code === '42P01' || e.code === 'PGRST205' || /does not exist|Could not find the table/i.test(e.message ?? '')
}

/**
 * Tutto il Biofeedback di una scheda, per il professionista indicato.
 * Senza professionista non c'è perimetro: niente.
 */
export async function loadBiofeedbackForClient(
  professionistaId: string | null,
  clientId: string,
  clientUserId: string | null,
): Promise<BiofeedbackScheda> {
  if (!professionistaId) return BIOFEEDBACK_VUOTO
  const supabase = await createClient()
  const perimetro = await perimetroProfessionista(professionistaId)
  const filtro = clientUserId ? `client_id.eq.${clientId},user_id.eq.${clientUserId}` : `client_id.eq.${clientId}`

  const [s, v, a] = await Promise.all([
    supabase.from('biofeedback_sessions').select('*').or(filtro).order('iniziata_il', { ascending: false }).limit(400) as unknown as PromiseLike<Risposta>,
    supabase.from('resonance_assessments').select('*').or(filtro).order('iniziata_il', { ascending: false }).limit(50) as unknown as PromiseLike<Risposta>,
    clientUserId
      ? (supabase
          // Dalla app-064 le assegnazioni vivono in programma_attivita
          // (tipo biofeedback_percorso, stesso id delle vecchie righe).
          .from('programma_attivita')
          .select('*')
          .eq('professional_id', professionistaId)
          .eq('client_user_id', clientUserId)
          .eq('tipo', 'biofeedback_percorso')
          .order('created_at', { ascending: false })
          .limit(50) as unknown as PromiseLike<Risposta>)
      : Promise.resolve<Risposta>({ data: [], error: null }),
  ])

  if (tabellaAssente(s.error) || tabellaAssente(v.error) || tabellaAssente(a.error)) {
    return { ...BIOFEEDBACK_VUOTO, tabelleAssenti: true }
  }
  if (s.error) reportDataError('biofeedback_sessions', s.error)
  if (v.error) reportDataError('resonance_assessments', v.error)
  if (a.error) reportDataError('programma_attivita', a.error)

  const sessioni = (s.data ?? [])
    .map(parseBiofeedbackSession)
    .filter((x): x is BiofeedbackSession => !!x && nelPerimetro(x, perimetro))
  const valutazioni = (v.data ?? [])
    .map(parseResonanceAssessment)
    .filter((x): x is ResonanceAssessment => !!x && nelPerimetro(x, perimetro))
  const assegnazioni = (a.data ?? [])
    .map(parseBiofeedbackAssignment)
    .filter((x): x is BiofeedbackAssignment => !!x && x.professional_id === professionistaId)
  return { sessioni, valutazioni, assegnazioni, tabelleAssenti: false }
}
