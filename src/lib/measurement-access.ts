import type { createClient } from './supabase-server'
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
// REGOLA CORRETTA, in due passi distinti:
//   1. CHI PUÒ VEDERE IL CLIENTE  → lo decide la RLS di `clients`. Se la SELECT
//      con la sessione dell'utente restituisce la riga, il lettore è
//      autorizzato: la stessa policy copre proprietario, team e superadmin.
//      Nessun controllo applicativo aggiuntivo, altrimenti si torna al bug.
//   2. LA SESSIONE È DI QUEL CLIENTE? → confronto esplicito su client_id, con
//      il ponte per le sessioni remote (client_id NULL). Questo passo NON è
//      ridondante: senza, un id di sessione di un altro cliente dello stesso
//      studio finirebbe in un PDF intestato al cliente sbagliato.

export type AccessDenied = { status: number; error: string }

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
    return { denied: { status: 500, error: 'Non è stato possibile leggere l’anagrafica del cliente. Riprova tra qualche istante.' } }
  }
  if (!client) {
    return {
      denied: {
        status: 404,
        error: 'Cliente non trovato, oppure non accessibile con questo account. Se stai consultando i dati di un altro professionista, riapri la scheda dal suo elenco clienti.',
      },
    }
  }
  return { client }
}
