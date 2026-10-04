import type { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { Activity, AlertTriangle, ArrowRight, Calendar, NotebookPen, SunMoon, TrendingUp, UserCheck } from 'lucide-react'
import { MonitoringTable } from '@/components/monitoring/MonitoringTable'
import { listMonitoringSessionsForProfessional } from '@/lib/monitoring-data'
import { filterMonitoringByModules, getMyAccountAccess } from '@/lib/account-access'
import { MON } from '@/lib/monitoring-format'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { AdvancedTrendChart } from '@/components/dashboard/AdvancedTrendChart'
import { AlertBadge } from '@/components/dashboard/AlertBadge'
import { ScoreBar } from '@/components/dashboard/ScoreBar'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { InviteBanner } from '@/components/dashboard/InviteBanner'
import { LinkCell } from '@/components/dashboard/LinkCell'
import {
  aggregatedDailyAverages,
  clientsToContact,
  getCurrentUser,
  getProfessionalProfile,
  listAlerts,
  listClients,
  listPendingInvitesForCurrentUser,
  listRecentNotes,
  todaysMeasurements,
} from '@/lib/dashboard-data'
import { identificaCliente, ponteClienti } from '@/lib/client-bridge'
import { alertMessage, alertTypeLabel, mergeAlerts } from '@/lib/alert-rules'
import { listAlertEvents } from '@/lib/alert-rules-server'
import { noteCategoryLabel } from '@/lib/types'
import { formatGreeting, formatMeasuredTime, num, todayLong, daysSince } from '@/lib/format'
import { getLocale, getTranslations } from 'next-intl/server'
import { caricaOErrore } from '@/lib/data-error'
import { DataLoadNotice } from '@/components/dashboard/DataLoadNotice'

type Params = { params: { locale: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('dashboardHome.title'), robots: { index: false, follow: false } }
}

export const dynamic = 'force-dynamic'

// Numeri estratti dai messaggi dell'app: si conservano i decimali che hanno
// (0.45 → "0,45", 32 → "32"), al massimo due.
function decimalsOf(v: number): number {
  const s = String(v)
  const i = s.indexOf('.')
  return i < 0 ? 0 : Math.min(2, s.length - i - 1)
}

export default async function DashboardHome() {
  const locale = await getLocale()
  const [tGreeting, t, tAlerts, tScores, tClients, tc] = await Promise.all([
    getTranslations('dashboard.greeting'),
    getTranslations('dashboard.home'),
    getTranslations('alerts'),
    getTranslations('scores'),
    getTranslations('clients'),
    getTranslations('common'),
  ])
  const user = await getCurrentUser()
  const [professional, cronAlerts, appEvents, measurements, contacts, trend, allClients, notes, invites, monitoring] = await Promise.all([
    getProfessionalProfile(),
    listAlerts({ status: ['new', 'seen'], limit: 5 }),
    // Eventi valutati dall'app sulle regole di alert_rules (con la precedenza
    // per cliente): si mostrano insieme agli alert del cron.
    listAlertEvents({ unreadOnly: true, days: 14, limit: 10 }),
    todaysMeasurements(),
    clientsToContact(),
    caricaOErrore(aggregatedDailyAverages(365)),
    listClients(),
    listRecentNotes(3),
    listPendingInvitesForCurrentUser(),
    user ? listMonitoringSessionsForProfessional(user.id) : Promise.resolve([]),
  ])
  const recentMonitoring = filterMonitoringByModules(monitoring, await getMyAccountAccess()).slice(0, 5)
  const alerts = mergeAlerts(cronAlerts, appEvents, 6)

  const clientMap = new Map(allClients.map((c) => [c.id, c]))
  const totalActive = allClients.length
  const fmtNum = (v: number) => num(v, decimalsOf(v), locale)
  const clientName = (id: string) => {
    const c = clientMap.get(id)
    return c ? `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || tc('client') : tc('client')
  }
  // Nome della scheda già caricata con la RLS, senza ripetere la query.
  const nomeScheda = (id: string) => {
    const c = clientMap.get(id)
    if (!c) return null
    return `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || tc('client')
  }
  // Il ponte serve solo per le misurazioni auto-misurate che `todaysMeasurements`
  // non ha potuto agganciare a una scheda (nessuna scheda, o sessione anonima).
  const ponte = user ? await ponteClienti(user.id) : { clientIdByUser: new Map(), profiloByUser: new Map() }

  return (
    <DashboardLayout professional={professional}>
      <InviteBanner invites={invites} />
      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          {formatGreeting(tGreeting)}, <em className="italic text-teal-dark">{professional?.nome ?? tc('professional')}</em>
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter capitalize">{todayLong(locale)}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                <h2 className="font-serif text-lg text-anthracite">{t('priorityAlerts')}</h2>
              </div>
              <Link href="/area-professionisti/clienti" className="text-sm text-teal-dark hover:underline whitespace-nowrap">{tc('seeAll')}</Link>
            </div>
            {alerts.length === 0 ? (
              <EmptyState icon={UserCheck} title={t('noAlertsTitle')} description={t('noAlertsBody')} />
            ) : (
              <ul className="divide-y divide-surface-border">
                {alerts.map((a) => {
                  const detail = alertMessage(a, tAlerts, fmtNum)
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/area-professionisti/clienti/${a.client_id}`}
                        className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface transition-colors"
                      >
                        <AlertBadge severity={a.severity} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-anthracite truncate">{clientName(a.client_id)}</div>
                          <div className="text-xs text-anthracite-lighter mt-0.5">
                            {alertTypeLabel(a.type, tAlerts)}{detail ? ` · ${detail}` : ''}
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-anthracite-lighter flex-shrink-0" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Activity size={18} className="text-teal flex-shrink-0" />
                <h2 className="font-serif text-lg text-anthracite">{t('todaysMeasurements')}</h2>
                <span className="text-sm text-anthracite-lighter">({measurements.length})</span>
              </div>
            </div>
            {measurements.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-anthracite-lighter">
                {t('noMeasurementsToday')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-anthracite-lighter">
                    <tr>
                      <th className="text-left px-6 py-2.5 text-[11px] uppercase tracking-wide font-medium">{tc('client')}</th>
                      <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('colTime')}</th>
                      <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{tScores('names.stress')}</th>
                      <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{tScores('names.recovery')}</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.slice(0, 10).map((m) => {
                      const chi = identificaCliente(m, ponte, nomeScheda)
                      // Senza scheda non esiste una pagina misurazione: si manda
                      // dove l'attribuzione si può sistemare, non su un id nullo.
                      const href = chi.clientId
                        ? `/area-professionisti/clienti/${chi.clientId}/misurazione/${m.session_id}`
                        : '/area-professionisti/clienti'
                      return (
                        <tr key={m.id} className="border-t border-surface-border hover:bg-surface transition-colors">
                          <LinkCell href={href} primary padding="px-6 py-3" className="font-medium text-anthracite">
                            {chi.kind === 'non_assegnata' ? (
                              <span className="text-anthracite-lighter italic">{t('unassignedMeasurement')}</span>
                            ) : (
                              <>
                                {chi.nome}
                                {chi.kind === 'profilo' && (
                                  <span className="ml-2 text-[11px] font-normal text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 whitespace-nowrap">
                                    {t('noCard')}
                                  </span>
                                )}
                              </>
                            )}
                          </LinkCell>
                          <LinkCell href={href} className="text-anthracite-lighter">{formatMeasuredTime(m, locale)}</LinkCell>
                          <LinkCell href={href} className="w-40"><ScoreBar value={m.score_stress} inverted /></LinkCell>
                          <LinkCell href={href} className="w-40"><ScoreBar value={m.score_recupero} /></LinkCell>
                          <LinkCell href={href} className="text-right">
                            <span className="text-teal-dark text-sm whitespace-nowrap">{tc('open')} →</span>
                          </LinkCell>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <SunMoon size={18} style={{ color: MON.accent }} className="flex-shrink-0" />
                <h2 className="font-serif text-lg text-anthracite">{t('recentMonitoring')}</h2>
                <span className="text-sm text-anthracite-lighter">({recentMonitoring.length})</span>
              </div>
              <Link href="/area-professionisti/monitoraggio" className="text-sm hover:underline whitespace-nowrap" style={{ color: MON.accentDark }}>{tc('seeAll')}</Link>
            </div>
            <MonitoringTable sessions={recentMonitoring} compact emptyText={t('noMonitoring')} />
          </section>

          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar size={18} className="text-anthracite flex-shrink-0" />
                <h2 className="font-serif text-lg text-anthracite">{t('toContact')}</h2>
              </div>
            </div>
            {contacts.length === 0 ? (
              <EmptyState icon={UserCheck} title={t('noContactTitle')} description={t('noContactBody')} />
            ) : (
              <ul className="divide-y divide-surface-border">
                {contacts.map((c) => (
                  <li key={c.client.id}>
                    <Link href={`/area-professionisti/clienti/${c.client.id}?tab=messaggi`} className="px-6 py-3.5 flex items-center gap-4 flex-wrap hover:bg-surface transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-anthracite truncate">{c.client.nome} {c.client.cognome}</div>
                        <div className="text-xs text-anthracite-lighter mt-0.5">
                          {t('lastMeasurementDaysAgo', { count: c.daysSinceLast })}
                        </div>
                      </div>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">
                        {t('daysShort', { count: c.daysSinceLast })}
                      </span>
                      <span className="text-teal-dark text-sm whitespace-nowrap">{t('reminder')} →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label={t('activeClients')} value={totalActive} hint={t('totalHint')} />
            <MetricCard label={t('measurementsToday')} value={measurements.length} />
            <MetricCard label={t('alertsResolved')} value="—" hint={t('weekHint')} />
            <MetricCard label={t('trend')} value="—" hint={t('vsLastMonth')} />
          </div>

          <section className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-teal flex-shrink-0" />
              <h3 className="font-serif text-base text-anthracite">{t('aggregateTrend')}</h3>
            </div>
            {trend.ok ? (
              <AdvancedTrendChart
                data={trend.data}
                defaultSelected={['score_stress', 'score_recupero']}
                defaultPreset="30"
                height={220}
                storageKey="sx-home-trend"
                showBrush={false}
              />
            ) : (
              <DataLoadNotice />
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2">
              <NotebookPen size={16} className="text-anthracite flex-shrink-0" />
              <h3 className="font-serif text-base text-anthracite">{t('latestNotes')}</h3>
            </div>
            {notes.length === 0 ? (
              <div className="px-5 py-6 text-sm text-anthracite-lighter text-center">{t('noRecentNotes')}</div>
            ) : (
              <ul className="divide-y divide-surface-border">
                {notes.map((n) => {
                  const days = daysSince(n.data_creazione) ?? 0
                  const category = noteCategoryLabel(n.categoria, tClients)
                  return (
                    <li key={n.id} className="px-5 py-3">
                      <Link href={`/area-professionisti/clienti/${n.client_id}?tab=note`} className="block hover:bg-surface -mx-5 px-5 py-1 transition-colors">
                        <div className="text-xs font-medium text-anthracite-lighter mb-0.5 truncate">
                          {clientName(n.client_id)} · {t('daysAgoShort', { count: days })}
                          {category ? ` · ${category}` : ''}
                        </div>
                        <p className="text-sm text-anthracite line-clamp-2">{n.testo}</p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </DashboardLayout>
  )
}
