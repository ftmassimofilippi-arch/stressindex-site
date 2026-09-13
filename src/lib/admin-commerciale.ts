import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// SUPER ADMIN — stato account, abbonamenti e moduli (migration 024).
// Solo lettura dei risultati: la logica di accesso è in has_module_access /
// modulo_accesso_dettaglio (DB). Da usare solo da route requireSuperadmin().
// ============================================================================

export type AccountStato = 'attivo' | 'prova' | 'sospeso' | 'bloccato'

export type ModuloCatalogo = { codice: string; nome: string; descrizione: string | null; icona: string | null; ordine: number; attivo: boolean }
export type PianoCatalogo = { codice: string; nome: string; ordine: number; moduli: string[] }

// fonte: da dove viene l'accesso (vedi modulo_accesso_dettaglio)
export type ModuloFonte = 'superadmin' | 'stato' | 'modulo_disattivato' | 'eccezione' | 'piano' | 'scaduto' | 'professionista' | 'nessuna'

export type AccountModulo = {
  codice: string
  attivo: boolean
  fonte: ModuloFonte
  incluso_nel_piano: boolean
  eccezione_abilitata: boolean | null
  eccezione_scade_il: string | null
  eccezione_motivo: string | null
}

export type AccountCommerciale = {
  stato: AccountStato
  stato_motivo: string | null
  stato_cambiato_il: string | null
  stato_cambiato_da: string | null
  piano: string | null
  data_inizio: string | null
  data_scadenza: string | null
  giorni_alla_scadenza: number | null
  rinnovo_automatico: boolean
  abbonamento_note: string | null
  moduli: AccountModulo[]
}

export type StoricoAbbonamento = {
  id: number
  evento: string
  piano_prima: string | null
  piano_dopo: string | null
  scadenza_prima: string | null
  scadenza_dopo: string | null
  mesi: number | null
  note: string | null
  eseguito_il: string
  eseguito_da_email: string | null
}

export type AuditRiga = { id: string; action: string; performed_by_email: string | null; details: Record<string, unknown>; created_at: string }

function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return ['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code ?? '') || (error.message ?? '').includes('does not exist')
}

export async function getCatalogo(admin: SupabaseClient): Promise<{ moduli: ModuloCatalogo[]; piani: PianoCatalogo[] } | null> {
  const [m, p, pm] = await Promise.all([
    admin.from('moduli').select('codice, nome, descrizione, icona, ordine, attivo').order('ordine'),
    admin.from('piani').select('codice, nome, ordine').order('ordine'),
    admin.from('piano_moduli').select('piano, modulo'),
  ])
  if (m.error || p.error || pm.error) {
    if (isMissing(m.error) || isMissing(p.error) || isMissing(pm.error)) return null
    throw new Error((m.error ?? p.error ?? pm.error)?.message)
  }
  const byPiano = new Map<string, string[]>()
  for (const r of (pm.data ?? []) as Array<{ piano: string; modulo: string }>) {
    byPiano.set(r.piano, [...(byPiano.get(r.piano) ?? []), r.modulo])
  }
  return {
    moduli: (m.data ?? []) as ModuloCatalogo[],
    piani: ((p.data ?? []) as Array<{ codice: string; nome: string; ordine: number }>).map((x) => ({ ...x, moduli: byPiano.get(x.codice) ?? [] })),
  }
}

// Stato + abbonamento + moduli di tutti gli account. null = 024 non applicata.
export async function getCommercialeByUser(admin: SupabaseClient): Promise<Map<string, AccountCommerciale> | null> {
  const PAGE = 1000 // PostgREST restituisce al massimo 1000 righe per richiesta
  const viewRows: Array<Omit<AccountCommerciale, 'moduli'> & { user_id: string }> = []
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await admin.from('v_admin_account').select('*').order('user_id').range(from, from + PAGE - 1)
    if (error) {
      if (isMissing(error)) return null
      throw new Error(error.message)
    }
    viewRows.push(...((data ?? []) as typeof viewRows))
    if ((data ?? []).length < PAGE) break
  }
  const moduli: Array<{ user_id: string; modulo: string } & Omit<AccountModulo, 'codice'>> = []
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await admin.rpc('admin_account_moduli').range(from, from + PAGE - 1)
    if (error) {
      if (isMissing(error)) return null
      throw new Error(error.message)
    }
    const rows = (data ?? []) as typeof moduli
    moduli.push(...rows)
    if (rows.length < PAGE) break
  }
  const modByUser = new Map<string, AccountModulo[]>()
  for (const r of moduli) {
    const arr = modByUser.get(r.user_id) ?? []
    arr.push({
      codice: r.modulo,
      attivo: !!r.attivo,
      fonte: r.fonte,
      incluso_nel_piano: !!r.incluso_nel_piano,
      eccezione_abilitata: r.eccezione_abilitata ?? null,
      eccezione_scade_il: r.eccezione_scade_il ?? null,
      eccezione_motivo: r.eccezione_motivo ?? null,
    })
    modByUser.set(r.user_id, arr)
  }
  const out = new Map<string, AccountCommerciale>()
  for (const v of viewRows) {
    out.set(v.user_id, {
      stato: v.stato,
      stato_motivo: v.stato_motivo,
      stato_cambiato_il: v.stato_cambiato_il,
      stato_cambiato_da: v.stato_cambiato_da,
      piano: v.piano,
      data_inizio: v.data_inizio,
      data_scadenza: v.data_scadenza,
      giorni_alla_scadenza: v.giorni_alla_scadenza,
      rinnovo_automatico: !!v.rinnovo_automatico,
      abbonamento_note: v.abbonamento_note,
      moduli: modByUser.get(v.user_id) ?? [],
    })
  }
  return out
}

// Storico dell'abbonamento + righe di audit commerciali/email di un account.
export async function getAccountHistory(admin: SupabaseClient, userId: string): Promise<{ storico: StoricoAbbonamento[]; audit: AuditRiga[] }> {
  const [s, a] = await Promise.all([
    admin.from('abbonamenti_storico').select('id, evento, piano_prima, piano_dopo, scadenza_prima, scadenza_dopo, mesi, note, eseguito_il, eseguito_da_email').eq('user_id', userId).order('eseguito_il', { ascending: false }).limit(100),
    admin
      .from('admin_audit_log')
      .select('id, action, performed_by_email, details, created_at')
      .eq('target_id', userId)
      .in('action', ['account_status_change', 'subscription_change', 'subscription_extend', 'subscription_auto_renew', 'module_exception_change', 'change_account_email', 'auth_ban', 'auth_unban'])
      .order('created_at', { ascending: false })
      .limit(100),
  ])
  return {
    storico: s.error ? [] : ((s.data ?? []) as StoricoAbbonamento[]),
    audit: a.error ? [] : ((a.data ?? []) as AuditRiga[]),
  }
}

// Messaggi leggibili per gli errori restituiti dalle funzioni admin_* della 024.
export const COMMERCIALE_ERRORI: Record<string, string> = {
  stato_non_valido: 'Stato non valido',
  motivo_obbligatorio: 'Il motivo è obbligatorio',
  utente_inesistente: 'Utente inesistente',
  superadmin_non_sospendibile: 'Un superadmin non può essere sospeso o bloccato',
  piano_non_valido: 'Piano non valido',
  prova_senza_scadenza: 'Il piano prova richiede una data di scadenza',
  scadenza_prima_di_inizio: 'La scadenza è prima della data di inizio',
  mesi_non_validi: 'Durata del prolungamento non valida',
  nessun_abbonamento: 'L’account non ha un abbonamento: impostane uno prima di prolungare',
  modulo_non_valido: 'Modulo non valido',
  scadenza_nel_passato: 'La scadenza dell’eccezione è nel passato',
}

// Cambio rapido Base ↔ Pro (toggle legacy del pannello e della vista cliente):
// passa da admin_set_subscription mantenendo date, rinnovo e note. Senza la
// 024 aggiorna profiles.plan come prima.
export async function setPlanViaSubscription(
  admin: SupabaseClient,
  performer: { id: string; email?: string | null },
  userId: string,
  plan: 'base' | 'pro',
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: current, error: selErr } = await admin
    .from('abbonamenti')
    .select('piano, data_inizio, data_scadenza, rinnovo_automatico, note')
    .eq('user_id', userId)
    .maybeSingle()
  if (selErr && isMissing(selErr)) {
    const { error } = await admin.from('profiles').update({ plan }).eq('id', userId)
    return error ? { ok: false, error: error.message, status: 500 } : { ok: true }
  }
  if (selErr) return { ok: false, error: selErr.message, status: 500 }
  const c = current as { piano: string; data_inizio: string; data_scadenza: string | null; rinnovo_automatico: boolean; note: string | null } | null
  const { data, error } = await admin.rpc('admin_set_subscription', {
    p_user_id: userId,
    p_piano: plan,
    p_data_inizio: c?.data_inizio ?? null,
    p_data_scadenza: c?.data_scadenza ?? null,
    p_rinnovo: c?.rinnovo_automatico ?? false,
    p_note: c?.note ?? null,
    p_motivo: 'Cambio rapido del piano',
    p_by: performer.id,
    p_by_email: performer.email ?? null,
  })
  if (error) return { ok: false, error: error.message, status: 500 }
  const res = data as { ok?: boolean; error?: string }
  if (!res?.ok) return { ok: false, error: COMMERCIALE_ERRORI[res?.error ?? ''] ?? res?.error ?? 'errore', status: 422 }
  return { ok: true }
}
