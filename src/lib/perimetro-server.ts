import { cache } from 'react'
import { createClient } from './supabase-server'
import { reportDataError } from './data-error'
import { aBlocchi, perimetroDaLink, utentiDelPerimetro, type LinkPerimetro, type Perimetro } from './perimetro'

// Lettura del perimetro (vedi perimetro.ts) con la sessione dell'utente: la
// policy `professional_sees_own_links` concede al professionista i propri link,
// e il filtro esplicito su `professional_id` vale anche per chi, da superadmin,
// ne vedrebbe di più. Separato dal modulo puro perché usa next/headers.

/**
 * Perimetro del professionista dato, memorizzato per richiesta. Se i link non
 * si leggono il perimetro si RESTRINGE alle sole sessioni del professionista:
 * un errore non deve mai allargarlo.
 */
export const perimetroProfessionista = cache(async (professionistaId: string): Promise<Perimetro> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_professional_links')
    .select('professional_id, status, client_user_id, client_id')
    .eq('professional_id', professionistaId)
    .eq('status', 'active')
  if (error) {
    reportDataError('perimetroProfessionista', error)
    return { professionistaId, clientiCollegati: [] }
  }
  return perimetroDaLink(professionistaId, (data ?? []) as LinkPerimetro[])
})

/**
 * Esegue la stessa query una volta per blocco di `user_id` del perimetro e
 * unisce le righe. `build` riceve il blocco e deve applicarlo con
 * `.in('user_id', blocco)`. Il primo errore interrompe e torna al chiamante,
 * che decide se è bloccante.
 */
export async function perBlocchiDiUtenti<T, E>(
  perimetro: Perimetro,
  build: (utenti: string[]) => PromiseLike<{ data: T[] | null; error: E | null }>,
): Promise<{ data: T[]; error: E | null }> {
  const risposte = await Promise.all(aBlocchi(utentiDelPerimetro(perimetro)).map((blocco) => build(blocco)))
  const errore = risposte.find((r) => r.error)?.error ?? null
  if (errore) return { data: [], error: errore }
  return { data: risposte.flatMap((r) => r.data ?? []), error: null }
}
