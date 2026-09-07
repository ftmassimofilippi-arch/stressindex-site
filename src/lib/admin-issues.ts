// Segnalazioni diagnostiche del pannello Super Admin (tab Utenti).
// Modulo senza dipendenze server: importabile anche dai componenti client.
//
// Ogni utente ha al più UNA segnalazione. I casi sono distinti perché
// richiedono azioni diverse dal superadmin:
//   • no_link            cliente senza alcun collegamento → va collegato a un professionista
//   • pending_link       cliente con invito in attesa di accettazione → va attivato (o accettato dal professionista in app)
//   • revoked_link       cliente con soli collegamenti revocati → va riattivato o ricollegato
//   • incomplete_profile professionista senza riga professional_profiles → completare il profilo
//   • no_profile         utente auth senza riga profiles → ruolo da assegnare

export type AdminIssue = 'no_link' | 'pending_link' | 'revoked_link' | 'incomplete_profile' | 'no_profile'

export const ADMIN_ISSUE_LABELS: Record<AdminIssue, string> = {
  no_link: 'Nessun collegamento',
  pending_link: 'Invito in attesa',
  revoked_link: 'Collegamento revocato',
  incomplete_profile: 'Profilo incompleto',
  no_profile: 'Senza profilo',
}

export const ADMIN_ISSUE_HINTS: Record<AdminIssue, string> = {
  no_link: 'Il cliente non ha nessun collegamento a un professionista, né attivo né in attesa.',
  pending_link: 'Esiste un collegamento in attesa di accettazione: il professionista deve accettarlo in app, oppure puoi attivarlo dalla tab Collegamenti.',
  revoked_link: 'Il cliente ha solo collegamenti revocati: riattivane uno dalla tab Collegamenti o creane uno nuovo.',
  incomplete_profile: 'Manca la riga professional_profiles: il professionista non ha completato il profilo.',
  no_profile: "L'utente esiste in auth ma non ha una riga profiles: nessun ruolo assegnato.",
}

// Tono del badge: ambra = richiede attenzione ma è uno stato "normale" del
// flusso (invito), rosso = anomalia da sistemare.
export const ADMIN_ISSUE_TONE: Record<AdminIssue, 'amber' | 'red'> = {
  no_link: 'red',
  pending_link: 'amber',
  revoked_link: 'red',
  incomplete_profile: 'amber',
  no_profile: 'red',
}

export const ADMIN_ISSUE_ORDER: AdminIssue[] = ['no_link', 'pending_link', 'revoked_link', 'incomplete_profile', 'no_profile']

// Rango degli stati di un collegamento: quando un utente/scheda ha più link,
// vince quello di rango più alto (active > pending > revoked).
const LINK_STATUS_RANK: Record<string, number> = { active: 3, pending: 2, revoked: 1 }
export function linkStatusRank(status: string | null | undefined): number {
  return status ? LINK_STATUS_RANK[status] ?? 0 : 0
}
export function pickBestLink<T extends { status: string }>(links: T[]): T | null {
  let best: T | null = null
  for (const l of links) if (!best || linkStatusRank(l.status) > linkStatusRank(best.status)) best = l
  return best
}

// Etichetta testuale dello stato di collegamento di un cliente.
export function clientLinkStatusLabel(status: string | null | undefined): string {
  if (status === 'active') return 'Collegamento attivo'
  if (status === 'pending') return 'Invito in attesa'
  if (status === 'revoked') return 'Collegamento revocato'
  return 'Nessun collegamento'
}
