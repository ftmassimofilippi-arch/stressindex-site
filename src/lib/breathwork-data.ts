// Breathwork: lettura delle tabelle della app-062 per la scheda cliente,
// con la sessione dell'utente (RLS) e il perimetro esplicito.
//
// Le attività: quelle del professionista loggato per l'account collegato
// alla scheda. I completamenti: dell'account collegato, solo delle
// attività caricate. Le sessioni degli esercizi seguono la persona misurata
// (`user_id`): per una scheda le righe con `client_id` = scheda, oppure
// `user_id` = account collegato; in ogni caso solo nel perimetro. Gli
// esercizi: quelli leggibili (libreria, i propri, quelli assegnati), per i
// nomi delle attività.
//
// Finché la app-062 non è applicata le tabelle non esistono: liste vuote e
// `tabelleAssenti`, senza errori in pagina.
import { createClient } from './supabase-server'
import { reportDataError } from './data-error'
import { perimetroProfessionista } from './perimetro-server'
import { nelPerimetro } from './perimetro'
import {
  BREATHWORK_VUOTO,
  parseAttivita,
  parseBreathworkSession,
  parseCompletamento,
  parseEsercizio,
  type AttivitaProgramma,
  type BreathworkScheda,
  type BreathworkSession,
  type Completamento,
  type Esercizio,
} from './breathwork'

export { BREATHWORK_VUOTO, type BreathworkScheda }

type Raw = Record<string, unknown>
type Risposta = { data: Raw[] | null; error: { code?: string; message?: string } | null }

function tabellaAssente(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  return e.code === '42P01' || e.code === 'PGRST205' || /does not exist|Could not find the table/i.test(e.message ?? '')
}

export async function loadBreathworkForClient(
  professionistaId: string | null,
  clientId: string,
  clientUserId: string | null,
): Promise<BreathworkScheda> {
  if (!professionistaId) return BREATHWORK_VUOTO
  const supabase = await createClient()
  const perimetro = await perimetroProfessionista(professionistaId)
  const filtro = clientUserId ? `client_id.eq.${clientId},user_id.eq.${clientUserId}` : `client_id.eq.${clientId}`

  const [a, c, s, e] = await Promise.all([
    clientUserId
      ? (supabase
          .from('programma_attivita')
          .select('*')
          .eq('professional_id', professionistaId)
          .eq('client_user_id', clientUserId)
          .order('created_at', { ascending: false })
          .limit(100) as unknown as PromiseLike<Risposta>)
      : Promise.resolve<Risposta>({ data: [], error: null }),
    clientUserId
      ? (supabase
          .from('programma_completamenti')
          .select('*')
          .eq('user_id', clientUserId)
          .order('giorno', { ascending: false })
          .limit(2000) as unknown as PromiseLike<Risposta>)
      : Promise.resolve<Risposta>({ data: [], error: null }),
    supabase.from('breathwork_sessions').select('*').or(filtro).order('iniziata_il', { ascending: false }).limit(400) as unknown as PromiseLike<Risposta>,
    supabase.from('breathwork_exercises').select('*').limit(500) as unknown as PromiseLike<Risposta>,
  ])

  if (tabellaAssente(a.error) || tabellaAssente(c.error) || tabellaAssente(s.error) || tabellaAssente(e.error)) {
    return { ...BREATHWORK_VUOTO, tabelleAssenti: true }
  }
  if (a.error) reportDataError('programma_attivita', a.error)
  if (c.error) reportDataError('programma_completamenti', c.error)
  if (s.error) reportDataError('breathwork_sessions', s.error)
  if (e.error) reportDataError('breathwork_exercises', e.error)

  const attivita = (a.data ?? [])
    .map(parseAttivita)
    .filter((x): x is AttivitaProgramma => !!x && x.professional_id === professionistaId)
  const ids = new Set(attivita.map((x) => x.id))
  const completamenti = (c.data ?? [])
    .map(parseCompletamento)
    .filter((x): x is Completamento => !!x && ids.has(x.attivita_id) && nelPerimetro(x, perimetro))
  const sessioni = (s.data ?? [])
    .map(parseBreathworkSession)
    .filter((x): x is BreathworkSession => !!x && nelPerimetro(x, perimetro))
  const esercizi = (e.data ?? []).map(parseEsercizio).filter((x): x is Esercizio => !!x)
  return { attivita, completamenti, sessioni, esercizi, tabelleAssenti: false }
}
