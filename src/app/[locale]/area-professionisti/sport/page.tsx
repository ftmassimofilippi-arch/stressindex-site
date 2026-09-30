import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Lock } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { SuperadminAccessLog } from '@/components/dashboard/SuperadminAccessLog'
import { getProfessionalProfile } from '@/lib/dashboard-data'
import {
  getSportDashboardStats,
  listSportAthletes,
  listSportSessions,
  resolveSportContext,
} from '@/lib/sport-data'
import { SportTabs } from './SportTabs'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('sportModule.title'), robots: { index: false, follow: false } }
}

export default async function SportPage({
  searchParams,
}: {
  searchParams?: { professionista?: string }
}) {
  const t = await getTranslations('sport')
  const { professionalId, viewing, access } = await resolveSportContext(searchParams?.professionista)
  const [professional] = await Promise.all([
    getProfessionalProfile(),
  ])

  // Gating Pro: la sezione è riservata ai professionisti con plan='pro'
  // (il superadmin ha sempre accesso). Per gli altri mostriamo un invito all'upgrade.
  if (!access.isPro) {
    return (
      <DashboardLayout professional={professional}>
        <div className="max-w-xl mx-auto card p-10 text-center mt-10">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-light text-teal-dark flex items-center justify-center mb-5">
            <Lock size={26} />
          </div>
          <h1 className="font-serif text-2xl text-anthracite">{t('gate.title')}</h1>
          <p className="mt-2 text-sm text-anthracite-lighter">
            {t.rich('gate.text', { b: (c) => <strong>{c}</strong> })}
          </p>
          <Link href="/sport" className="btn-primary text-sm mt-6 inline-flex">{t('gate.cta')}</Link>
        </div>
      </DashboardLayout>
    )
  }

  const isSuperadminView = viewing?.access === 'superadmin'

  const [stats, sessions, athletes] = await Promise.all([
    getSportDashboardStats(professionalId),
    listSportSessions(professionalId),
    listSportAthletes(professionalId),
  ])

  // Elenco sport distinti per il filtro della tab Sessioni.
  const sports = Array.from(new Set(sessions.map((s) => s.sport).filter((s): s is string => !!s))).sort()
  // Elenco atleti per il dropdown filtro (id → nome).
  const athleteOptions = athletes.map((a) => ({ id: a.id, name: a.full_name }))

  const basePath = viewing ? `?professionista=${viewing.user_id}` : ''

  return (
    <DashboardLayout professional={professional}>
      {viewing && access.userId && isSuperadminView && (
        <SuperadminAccessLog adminId={access.userId} professionistaId={viewing.user_id} professionalName={viewing.full_name} />
      )}
      {viewing && (
        <div className="mb-6 flex items-center gap-3 flex-wrap px-5 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="text-sm text-amber-800 min-w-0">
            {t.rich('viewing.sport', { name: viewing.full_name, b: (c) => <strong>{c}</strong> })}
            {' · '}
            {isSuperadminView ? t('viewing.supportMode') : t('viewing.readOnly')}
          </div>
          <Link
            href={isSuperadminView ? '/area-professionisti/professionisti' : '/area-professionisti/organizzazione'}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:underline"
          >
            <ArrowLeft size={14} /> {isSuperadminView ? t('viewing.backToProfessionals') : t('viewing.backToTeam')}
          </Link>
        </div>
      )}

      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite flex items-center gap-3 flex-wrap">
            <span>{t.rich('heading', { em: (c) => <em className="italic text-teal-dark">{c}</em> })}</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-teal text-white align-middle">{t('proBadge')}</span>
          </h1>
          <p className="mt-1.5 text-sm text-anthracite-lighter">{t('subtitle')}</p>
        </div>
      </header>

      <SportTabs
        stats={stats}
        sessions={sessions}
        athletes={athletes}
        sports={sports}
        athleteOptions={athleteOptions}
        baseQuery={basePath}
      />
    </DashboardLayout>
  )
}
