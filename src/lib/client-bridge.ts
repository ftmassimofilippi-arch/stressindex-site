import { cache } from 'react'
import { buildBridge } from './remote-sessions'
import { createAdminClient, hasServiceRole } from './supabase-admin'
import type { MeasurementAnalytics } from './types'

// =============================================================================
// Chi è il cliente di una misurazione: un solo posto per rispondere
// =============================================================================
//
// Una misurazione fatta dal cliente sulla SUA app arriva con
//   measurement_analytics.client_id = NULL      (nessuna scheda CRM scritta)
//   measurement_analytics.user_id   = uid del cliente
// Il professionista la vede solo per la policy RLS della 019, che confronta
// `coalesce(cpl.client_user_id, cpl.client_id)` con `user_id`: mai per
// `client_id`. Chi indicizza le schede su `clients.id` — ed è quello che fanno
// la home e la pagina Analytics — su quelle righe non trova niente.
//
// Qui il ponte si risolve UNA volta per richiesta e si risponde a due domande
// diverse, che prima erano confuse fra loro:
//
//   1. «quale scheda CRM è questa misurazione?» → `conClientIdDalPonte`, che
//      riempie `client_id` dove è NULL. Serve a tutto ciò che raggruppa per
//      scheda (Analytics, i link alla scheda, i contatori).
//   2. «che nome scrivo in tabella?» → `identificaCliente`, con la scala dei
//      tre ripieghi: scheda → profilo → non assegnata. Il "—" non è una
//      risposta: nasconde al professionista una misurazione che possiede.
//
// Il ponte vero e proprio è `buildBridge` (remote-sessions.ts), che usa la
// service_role e va quindi chiamato solo con un `professionistaId` già
// autorizzato — qui è sempre l'utente loggato. Senza service_role si degrada
// senza rumore: i nomi che si possono risolvere dalle schede restano, gli
// altri diventano "non assegnata" invece di far cadere la pagina.

/** Identità di chi ha fatto la misurazione, con l'origine della risposta. */
export type IdentitaCliente =
  | { kind: 'scheda'; clientId: string; nome: string }
  /** Account app collegato ma senza scheda CRM: il nome viene da `profiles`. */
  | { kind: 'profilo'; clientId: null; userId: string; nome: string }
  /** Sessione anonima del professionista stesso: nessuno a cui attribuirla. */
  | { kind: 'non_assegnata'; clientId: null; userId: string | null }

type ProfiloCliente = { nome: string | null; cognome: string | null; email: string | null }

export type PonteClienti = {
  /** uid dell'account app → `clients.id` della scheda, quando la scheda esiste. */
  clientIdByUser: Map<string, string>
  /** uid dell'account app → profilo, per i collegati senza scheda. */
  profiloByUser: Map<string, ProfiloCliente>
}

const PONTE_VUOTO: PonteClienti = { clientIdByUser: new Map(), profiloByUser: new Map() }

function nomeCompleto(p: { nome?: string | null; cognome?: string | null } | null): string {
  return `${p?.nome ?? ''} ${p?.cognome ?? ''}`.trim()
}

/**
 * Ponte completo del professionista, memorizzato per richiesta: la home lo
 * chiede una volta per la card e una per i contatori, e non si paga due volte.
 */
export const ponteClienti = cache(async (professionistaId: string): Promise<PonteClienti> => {
  if (!hasServiceRole()) {
    console.warn('[client-bridge] SUPABASE_SERVICE_ROLE_KEY assente: i clienti delle misurazioni remote non sono risolvibili')
    return PONTE_VUOTO
  }

  const coppie = await buildBridge(professionistaId)
  const clientIdByUser = new Map<string, string>()
  for (const { clientId, userId } of coppie) clientIdByUser.set(userId, clientId)

  // Collegati ATTIVI senza scheda: il nome lo dà il profilo (ripiego 2). Senza
  // questa lettura resterebbero indistinguibili da una sessione non assegnata.
  const admin = createAdminClient()
  const { data: links, error: linkErr } = await admin
    .from('client_professional_links')
    .select('client_user_id')
    .eq('professional_id', professionistaId)
    .eq('status', 'active')
  if (linkErr) {
    console.error('[client-bridge] lettura collegamenti fallita', linkErr.message)
    return { clientIdByUser, profiloByUser: new Map() }
  }

  const senzaScheda = Array.from(
    new Set(
      ((links ?? []) as Array<{ client_user_id: string | null }>)
        .map((l) => l.client_user_id)
        .filter((v): v is string => !!v && !clientIdByUser.has(v)),
    ),
  )
  const profiloByUser = new Map<string, ProfiloCliente>()
  if (senzaScheda.length === 0) return { clientIdByUser, profiloByUser }

  const { data: profili, error: profErr } = await admin
    .from('profiles')
    .select('id, nome, cognome, email')
    .in('id', senzaScheda)
  if (profErr) {
    console.error('[client-bridge] lettura profili fallita', profErr.message)
    return { clientIdByUser, profiloByUser }
  }
  for (const p of (profili ?? []) as Array<{ id: string } & ProfiloCliente>) {
    profiloByUser.set(p.id, { nome: p.nome, cognome: p.cognome, email: p.email })
  }
  return { clientIdByUser, profiloByUser }
})

/**
 * Riempie `client_id` dove è NULL usando `user_id`. Le righe che il ponte non
 * risolve tornano come sono: chi raggruppa per scheda le salta come prima, chi
 * mostra un nome usa `identificaCliente` e dice "non assegnata".
 */
export function conClientIdDalPonte<T extends { client_id: string | null; user_id?: string | null }>(
  rows: T[],
  ponte: PonteClienti,
): T[] {
  if (ponte.clientIdByUser.size === 0) return rows
  return rows.map((r) => {
    if (r.client_id) return r
    const clientId = r.user_id ? ponte.clientIdByUser.get(r.user_id) : undefined
    return clientId ? { ...r, client_id: clientId } : r
  })
}

/**
 * La scala dei tre ripieghi. `nomeScheda` legge le schede già caricate dalla
 * pagina con la RLS attiva, così non si ripete una query che il chiamante ha
 * già fatto.
 */
export function identificaCliente(
  row: Pick<MeasurementAnalytics, 'client_id'> & { user_id?: string | null },
  ponte: PonteClienti,
  nomeScheda: (clientId: string) => string | null,
): IdentitaCliente {
  const userId = row.user_id ?? null

  // 1. Scheda CRM: diretta, oppure raggiunta dal ponte.
  const clientId = row.client_id ?? (userId ? ponte.clientIdByUser.get(userId) ?? null : null)
  if (clientId) {
    const nome = nomeScheda(clientId)
    if (nome) return { kind: 'scheda', clientId, nome }
  }

  // 2. Account collegato senza scheda: nome e cognome dal profilo.
  if (userId) {
    const p = ponte.profiloByUser.get(userId)
    const nome = nomeCompleto(p ?? null) || (p?.email ?? '')
    if (nome) return { kind: 'profilo', clientId: null, userId, nome }
  }

  // 3. Nessuno a cui attribuirla: vecchia sessione anonima del professionista.
  return { kind: 'non_assegnata', clientId: null, userId }
}
