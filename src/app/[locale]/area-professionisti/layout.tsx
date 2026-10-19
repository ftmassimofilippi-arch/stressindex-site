import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { getMyAccountAccess } from '@/lib/account-access'
import { SospesoView } from './sospeso/SospesoView'
import { ConsentGateView } from './consensi/ConsentGateView'
import { createClient } from '@/lib/supabase-server'
import { pendingFromMetadata, proConsentStatus, recordProConsents } from '@/lib/consents-server'
import type { Locale } from '@/i18n/routing'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta.proArea' })
  return {
    title: { default: t('title'), template: t('template') },
    description: t('description'),
    robots: { index: false, follow: false },
  }
}

// Stato commerciale dell'account (migration 024), letto UNA volta per richiesta
// (`getMyAccountAccess` è memorizzata) invece che nel middleware a ogni hop
// (audit QA 14/10, E4):
//   • bloccato → login con `?stato=bloccato` (la pagina chiude la sessione);
//   • sospeso  → la schermata "account sospeso" al posto di qualsiasi pagina.
// Login e recupero password passano anch'essi da questo layout, ma per chi non
// è loggato `userId` è nullo e non succede niente.
//
// Un CLIENTE loggato (profiles.role = 'client', invitato dal professionista)
// non ha niente qui: va a /app-cliente, PRIMA del gate consensi, altrimenti
// vedrebbe la dashboard vuota con il saluto "Professionista" o, peggio,
// firmerebbe i consensi da professionista. `role` null resta professionista.
// Nessuna query in più: `getMyAccountAccess` legge già la riga di profiles.
export default async function AreaProfessionistiLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  const access = await getMyAccountAccess()
  if (access.userId && access.role === 'client') {
    redirect({ href: '/app-cliente', locale: params.locale })
  }
  if (access.userId && access.stato === 'bloccato') {
    redirect({ href: { pathname: '/area-professionisti/login', query: { stato: 'bloccato' } }, locale: params.locale })
  }
  if (access.userId && access.stato === 'sospeso') {
    return <SospesoView />
  }
  if (access.userId && (await needsConsentGate(access.userId))) {
    return <ConsentGateView />
  }
  return <>{children}</>
}

// Pacchetto legale 2.1: senza i consensi obbligatori nella versione in vigore
// l'area professionisti mostra la riaccettazione. Chi si è registrato dal sito
// dopo il 17/10/2026 li ha dati nel form: sono nei metadata del signUp e si
// registrano qui al primo accesso, senza chiedere due volte. Se la sito-048 non
// è ancora applicata lo stato è 'unavailable' e nessuno viene bloccato.
async function needsConsentGate(userId: string): Promise<boolean> {
  const status = await proConsentStatus(userId)
  if (status !== 'missing') return false
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const pending = pendingFromMetadata(user?.user_metadata)
  if (!pending) return true
  const res = await recordProConsents({
    userId,
    consents: pending,
    lang: (['it', 'en', 'de'].includes(pending.lang) ? pending.lang : 'it') as Locale,
    ip: null,
    userAgent: pending.ua ?? null,
    grantedAt: pending.at,
  })
  return !res.ok
}
