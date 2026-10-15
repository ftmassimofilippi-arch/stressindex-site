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
  /** Schede non unite con un'ultima misurazione negli ultimi 90 giorni. */
  schedeAttive90: number
  /** Misurazioni degli ultimi 30 giorni. */
  misurazioni30: number
  /** Alert del cron aperti (`new`, `seen`). */
  alertAttivi: number
  /** Alert risolti automaticamente negli ultimi 7 giorni. */
  alertRisolti7: number
  /** Monitoraggi (24h e sonno), in tutto e negli ultimi 30 giorni. */
  monitoraggi: number
  monitoraggi30: number
}

export async function getPlatformCounts(): Promise<PlatformCounts | null> {
  const admin = createAdminClient()
  const daIso = inizioGiornoIta(oggiIta())
  const conta = (tabella: string) => admin.from(tabella).select('*', { count: 'exact', head: true })

  const giorniFa = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
  const [professionisti, schede, collegamenti, misurazioni, oggi, schede90, mis30, alertAttivi, alertRisolti, monit, monit30] = await Promise.all([
    conta('profiles').eq('role', 'professional'),
    conta('clients').is('merged_into_client_id', null),
    conta('client_professional_links').eq('status', 'active'),
    conta('sessions'),
    // Solo l'autore di ogni sessione di oggi: serve a contare, non a mostrare.
    admin.from('sessions').select('professionista_id').gte('started_at_utc', daIso).limit(5000),
    conta('clients').is('merged_into_client_id', null).gte('last_measurement_at', giorniFa(90)),
    conta('sessions').gte('started_at_utc', giorniFa(30)),
    conta('alerts').in('status', ['new', 'seen']),
    conta('alerts').eq('status', 'resolved').gte('resolved_at', giorniFa(7)),
    conta('monitoring_sessions'),
    conta('monitoring_sessions').gte('start_time', giorniFa(30)),
  ])
  const errore = professionisti.error ?? schede.error ?? collegamenti.error ?? misurazioni.error ?? oggi.error
    ?? schede90.error ?? mis30.error ?? alertAttivi.error ?? alertRisolti.error ?? monit.error ?? monit30.error
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
    schedeAttive90: schede90.count ?? 0,
    misurazioni30: mis30.count ?? 0,
    alertAttivi: alertAttivi.count ?? 0,
    alertRisolti7: alertRisolti.count ?? 0,
    monitoraggi: monit.count ?? 0,
    monitoraggi30: monit30.count ?? 0,
  }
}
