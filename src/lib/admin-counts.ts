import { createAdminClient } from './supabase-admin'
import { inizioGiornoIta, oggiIta } from './format'
import { reportDataError } from './data-error'

// =============================================================================
// SUPER ADMIN — conteggi aggregati della piattaforma (service_role)
// =============================================================================
//
// È ciò che resta al superadmin dei dati degli altri professionisti finché non
// esiste il consenso del cliente verso il Super Admin (superadmin-scope.ts):
// NUMERI, mai righe. Da qui non esce nessun nome, nessuna email, nessun id di
// cliente o di sessione, nessuno score. Chi aggiunge un campo a
// `PlatformCounts` aggiunge un conteggio, non un elenco.
//
// Usa la service_role: va chiamata solo dopo aver verificato `is_superadmin`.

export interface PlatformCounts {
  /** Account con ruolo professionista. */
  professionisti: number
  /** Schede cliente non unite ad altre. */
  schede: number
  /** Collegamenti cliente ↔ professionista con stato `active`. */
  collegamentiAttivi: number
  /** Misurazioni brevi (righe di `sessions`), in tutto. */
  misurazioni: number
  /** Misurazioni di oggi (giornata italiana), in tutto. */
  misurazioniOggi: number
  /** …di cui fatte da un professionista. */
  misurazioniOggiInStudio: number
  /** …di cui fatte da un cliente dalla propria app. */
  misurazioniOggiDaRemoto: number
  /** Professionisti con almeno una misurazione oggi. */
  professionistiAttiviOggi: number
}

export async function getPlatformCounts(): Promise<PlatformCounts | null> {
  const admin = createAdminClient()
  const daIso = inizioGiornoIta(oggiIta())
  const conta = (tabella: string) => admin.from(tabella).select('*', { count: 'exact', head: true })

  const [professionisti, schede, collegamenti, misurazioni, oggi] = await Promise.all([
    conta('profiles').eq('role', 'professional'),
    conta('clients').is('merged_into_client_id', null),
    conta('client_professional_links').eq('status', 'active'),
    conta('sessions'),
    // Solo l'autore di ogni sessione di oggi: serve a contare, non a mostrare.
    admin.from('sessions').select('professionista_id').gte('started_at_utc', daIso).limit(5000),
  ])
  const errore = professionisti.error ?? schede.error ?? collegamenti.error ?? misurazioni.error ?? oggi.error
  if (errore) {
    reportDataError('getPlatformCounts', errore)
    return null
  }

  const autori = ((oggi.data ?? []) as Array<{ professionista_id: string | null }>)
    .map((r) => r.professionista_id)
    .filter((v): v is string => !!v)
  const distinti = Array.from(new Set(autori))
  const professionali = new Set<string>()
  if (distinti.length > 0) {
    const { data, error } = await admin.from('profiles').select('id').eq('role', 'professional').in('id', distinti)
    if (error) {
      reportDataError('getPlatformCounts.ruoli', error)
      return null
    }
    for (const p of (data ?? []) as Array<{ id: string }>) professionali.add(p.id)
  }
  const inStudio = autori.filter((a) => professionali.has(a)).length

  return {
    professionisti: professionisti.count ?? 0,
    schede: schede.count ?? 0,
    collegamentiAttivi: collegamenti.count ?? 0,
    misurazioni: misurazioni.count ?? 0,
    misurazioniOggi: autori.length,
    misurazioniOggiInStudio: inStudio,
    misurazioniOggiDaRemoto: autori.length - inStudio,
    professionistiAttiviOggi: professionali.size,
  }
}
