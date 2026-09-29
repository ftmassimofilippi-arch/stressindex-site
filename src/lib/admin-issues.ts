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
//
// Le etichette e i suggerimenti stanno nei messaggi (`admin.issues.labels.*`,
// `admin.issues.hints.*`): si leggono con `t = useTranslations('admin')`.
import type { Tr } from '@/i18n/types'

export type AdminIssue = 'no_link' | 'pending_link' | 'revoked_link' | 'incomplete_profile' | 'no_profile'

export function adminIssueLabel(issue: AdminIssue, t: Tr): string {
  return t(`issues.labels.${issue}`)
}

export function adminIssueHint(issue: AdminIssue, t: Tr): string {
  return t(`issues.hints.${issue}`)
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

// Chiave (in `admin.clientLinkStatus`) dello stato di collegamento di un cliente.
export function clientLinkStatusKey(status: string | null | undefined): 'active' | 'pending' | 'revoked' | 'none' {
  if (status === 'active' || status === 'pending' || status === 'revoked') return status
  return 'none'
}

// Etichetta tradotta dello stato di collegamento di un cliente.
export function clientLinkStatusLabel(status: string | null | undefined, t: Tr): string {
  return t(`clientLinkStatus.${clientLinkStatusKey(status)}`)
}
