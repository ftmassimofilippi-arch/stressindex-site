import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from './supabase-server'
import type { MonitoringSession } from './monitoring-types'

// ============================================================================
// Stato dell'account e moduli dell'utente loggato (migration 024).
// ----------------------------------------------------------------------------
// La decisione è SOLO nel database: RPC my_account_access(), che usa
// has_module_access / modulo_accesso_dettaglio. Il sito non ricalcola nulla,
// legge il risultato una volta per richiesta (React cache).
// Se la 024 non è applicata (RPC assente) vale il comportamento precedente:
// Sport = plan 'pro' o superadmin, Monitoraggio e Sonno per tutti, account attivo.
// ============================================================================

export type AccountStato = 'attivo' | 'prova' | 'sospeso' | 'bloccato'
export type ModuleCode = 'sport' | 'monitoring' | 'sleep' | (string & {})

export interface AccountAccess {
  userId: string | null
  available: boolean // false = migration 024 non applicata (fallback legacy)
  stato: AccountStato
  piano: string | null
  dataScadenza: string | null
  giorniAllaScadenza: number | null
  moduli: Record<string, boolean>
  isSuperadmin: boolean
  plan: string | null // profiles.plan (copia legacy)
}

type RpcResult = {
  ok?: boolean
  stato?: AccountStato
  piano?: string | null
  data_scadenza?: string | null
  giorni_alla_scadenza?: number | null
  moduli?: Record<string, boolean>
}

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || error.code === '42883' || (error.message ?? '').includes('my_account_access')
}

/**
 * Stato dell'account di chi sta chiamando, con QUALUNQUE client Supabase che
 * porti la sua identità: i cookie della richiesta (middleware) o l'header
 * Authorization (requireProfessional, quindi anche l'app Flutter).
 *
 * null = non si sa: la 024 non è applicata, oppure la RPC è fallita. Chi chiama
 * in quel caso lascia passare, perché una guardia che non sa non deve chiudere
 * la porta a tutti.
 */
export async function fetchAccountStato(supabase: SupabaseClient): Promise<AccountStato | null> {
  const { data, error } = await supabase.rpc('my_account_access')
  if (error) {
    // La RPC assente è la normalità finché la 024 non è applicata: non è un
    // errore da segnalare. Tutto il resto sì, o un guasto vero resterebbe muto.
    if (!isMissingRpc(error)) console.error('[account-access] my_account_access', error.message)
    return null
  }
  if (!data) return null
  return ((data as RpcResult).stato ?? null) as AccountStato | null
}

export const getMyAccountAccess = cache(async (): Promise<AccountAccess> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const empty: AccountAccess = {
    userId: null, available: false, stato: 'attivo', piano: null, dataScadenza: null, giorniAllaScadenza: null,
    moduli: {}, isSuperadmin: false, plan: null,
  }
  if (!user) return empty

  const [{ data: prof }, rpc] = await Promise.all([
    supabase.from('profiles').select('plan, is_superadmin').eq('id', user.id).maybeSingle(),
    supabase.rpc('my_account_access'),
  ])
  const p = prof as { plan?: string | null; is_superadmin?: boolean } | null
  const isSuperadmin = !!p?.is_superadmin
  const plan = p?.plan ?? null

  if (rpc.error || !(rpc.data as RpcResult | null)?.ok) {
    if (rpc.error && !isMissingRpc(rpc.error)) console.error('[account-access] my_account_access', rpc.error)
    return {
      ...empty,
      userId: user.id,
      isSuperadmin,
      plan,
      moduli: { sport: plan === 'pro' || isSuperadmin, monitoring: true, sleep: true },
    }
  }
  const r = rpc.data as RpcResult
  return {
    userId: user.id,
    available: true,
    stato: r.stato ?? 'attivo',
    piano: r.piano ?? null,
    dataScadenza: r.data_scadenza ?? null,
    giorniAllaScadenza: r.giorni_alla_scadenza ?? null,
    moduli: r.moduli ?? {},
    isSuperadmin,
    plan,
  }
})

export function hasModule(access: AccountAccess, code: ModuleCode): boolean {
  return !!access.moduli[code]
}

// Monitoraggi visibili: 24h con il modulo monitoring, sonno con il modulo sleep.
export function filterMonitoringByModules<T extends Pick<MonitoringSession, 'monitoring_type'>>(sessions: T[], access: AccountAccess): T[] {
  const mon = hasModule(access, 'monitoring')
  const sleep = hasModule(access, 'sleep')
  if (mon && sleep) return sessions
  return sessions.filter((s) => (s.monitoring_type === 'sleep' ? sleep : mon))
}
