// =============================================================================
// Perimetro di un professionista: quali misurazioni sono "sue"
// =============================================================================
//
// Le pagine dell'area professionisti mostrano il lavoro di UN professionista:
//   • le sessioni che ha fatto lui                 (`user_id` = il suo uid);
//   • le automisurazioni dei clienti che ha collegati con link `active`
//                                                  (`user_id` = uid del cliente).
// Nient'altro, qualunque cosa conceda la RLS. Fino al 07/10/2026 le query si
// affidavano alla sola RLS, e per un superadmin le policy `superadmin_read_*`
// aprono tutto: la home mostrava le misurazioni di ogni utente del database.
// Il ruolo superadmin NON allarga il perimetro: qui dentro non compare.
//
// Modulo puro (niente next/headers, niente Supabase): lo importano i test e,
// se serve, i componenti client. La lettura dei link sta in perimetro-server.ts.

export type Perimetro = {
  professionistaId: string
  /** uid degli account app collegati con link `active`, senza duplicati. */
  clientiCollegati: string[]
}

/** Riga di `client_professional_links`, con le sole colonne che servono. */
export type LinkPerimetro = {
  professional_id: string | null
  status: string | null
  client_user_id: string | null
  /** Ponte legacy: sulle righe vecchie l'uid del cliente sta qui. */
  client_id: string | null
}

/**
 * Perimetro a partire dai link letti dal database. Il filtro su professionista
 * e stato si ripete qui anche se la query lo applica già: una riga in più nella
 * risposta non deve poter allargare il perimetro. L'uid del cliente si legge
 * come nella policy `professional_reads_linked_client_analytics`:
 * `coalesce(client_user_id, client_id)`.
 */
export function perimetroDaLink(professionistaId: string, links: LinkPerimetro[]): Perimetro {
  const collegati = new Set<string>()
  for (const l of links) {
    if (l.professional_id !== professionistaId || l.status !== 'active') continue
    const uid = l.client_user_id ?? l.client_id
    if (uid && uid !== professionistaId) collegati.add(uid)
  }
  return { professionistaId, clientiCollegati: Array.from(collegati) }
}

/** Tutti i `user_id` ammessi: il professionista per primo, poi i collegati. */
export function utentiDelPerimetro(p: Perimetro): string[] {
  return [p.professionistaId, ...p.clientiCollegati]
}

/** La riga è del professionista o di un suo cliente collegato? */
export function nelPerimetro(row: { user_id?: string | null }, p: Perimetro): boolean {
  const uid = row.user_id
  if (!uid) return false
  return uid === p.professionistaId || p.clientiCollegati.includes(uid)
}

/** Automisurazione di un cliente collegato (non una sessione del professionista). */
export function misurataDalCliente(row: { user_id?: string | null }, professionistaId: string): boolean {
  return !!row.user_id && row.user_id !== professionistaId
}

/**
 * Spezza una lista in blocchi: un `in (...)` con centinaia di uuid supera la
 * lunghezza di URL che PostgREST accetta.
 */
export function aBlocchi<T>(valori: T[], dimensione = 100): T[][] {
  const out: T[][] = []
  for (let i = 0; i < valori.length; i += dimensione) out.push(valori.slice(i, i + dimensione))
  return out
}
