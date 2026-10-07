import type { SupabaseClient } from '@supabase/supabase-js'
import type { createClient } from './supabase-server'
import { assertOwnerOrSuperadmin } from './print-access'
import type { Client } from './types'

// =============================================================================
// Autorizzazione condivisa delle route PDF
// =============================================================================
//
// PERCHÉ ESISTE: le due route PDF verificavano la proprietà con un confronto
// secco `professionista_id !== auth.uid()`, che nega l'accesso a chiunque non
// sia il proprietario diretto della riga — anche quando la RLS gli ha appena
// mostrato quegli stessi dati. Effetto reale: il superadmin (e l'owner/admin di
// un'organizzazione) apriva il dettaglio misurazione di un cliente altrui in
// sola lettura, ma il pulsante "Scarica PDF" rispondeva 403 "Accesso negato".
//
// REGOLA, in due passi distinti:
//   1. CHI PUÒ VEDERE IL CLIENTE  → la RLS di `clients` deve restituire la
//      riga, E l'utente deve esserne il titolare. La sola RLS non basta più
//      (07/10/2026): `superadmin_read_clients` concede a un superadmin le
//      schede di tutti, e il PDF di un cliente altrui usciva con un id
//      nell'URL. Il superadmin torna a passare solo con il consenso del
//      cliente (superadmin-scope.ts), e allora questo controllo lo lascia
//      passare: il 403 del vecchio confronto secco non torna.
//   2. LA SESSIONE È DI QUEL CLIENTE? → confronto esplicito su client_id, con
//      il ponte per le sessioni remote (client_id NULL). Questo passo NON è
//      ridondante: senza, un id di sessione di un altro cliente dello stesso
//      studio finirebbe in un PDF intestato al cliente sbagliato.

/** `error` è un CODICE stabile (`errors.api.<codice>`): la route lo restituisce
 *  con `apiError(denied.error, denied.status)` e la UI lo traduce. */
export type AccessDenied = { status: number; error: 'client_read_failed' | 'client_not_found' }

type ServerClient = Awaited<ReturnType<typeof createClient>>

// clients.id è `text` in formato epoch-millis, sessions.client_id pure, ma i due
// valori arrivano da sorgenti diverse (URL, JSON body, DB): normalizziamo prima
// di confrontare, così uno spazio o un tipo numerico non causano un falso 403.
export function sameId(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false
  return String(a).trim() === String(b).trim()
}

// Passo 1: carica il cliente con la sessione dell'utente (RLS attiva).
// `null` = non esiste oppure questo account non è autorizzato a vederlo: le due
// cose non sono distinguibili sotto RLS, e non devono esserlo (enumeration).
export async function loadAuthorizedClient(
  supabase: ServerClient,
  clientId: string,
): Promise<{ client: Client } | { denied: AccessDenied }> {
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle<Client>()

  if (error) {
    console.error('[measurement-access] lettura cliente fallita', { clientId, error })
    return { denied: { status: 500, error: 'client_read_failed' } }
  }
  if (!client) {
    return { denied: { status: 404, error: 'client_not_found' } }
  }
  // Stessa risposta di "non esiste": a chi non è il titolare non si dice altro.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertOwnerOrSuperadmin(supabase as unknown as SupabaseClient, user.id, client.professionista_id))) {
    return { denied: { status: 404, error: 'client_not_found' } }
  }
  return { client }
}
