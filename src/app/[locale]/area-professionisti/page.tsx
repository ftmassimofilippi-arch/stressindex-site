import type { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { Activity, AlertTriangle, ArrowRight, Calendar, NotebookPen, SunMoon, TrendingUp, UserCheck } from 'lucide-react'
import { MonitoringTable } from '@/components/monitoring/MonitoringTable'
import { listMonitoringSessionsForProfessional } from '@/lib/monitoring-data'
import { filterMonitoringByModules, getMyAccountAccess } from '@/lib/account-access'
import { MON } from '@/lib/monitoring-format'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { getDataScope } from '@/lib/data-scope-server'
import { GlobalScopePanel } from '@/components/dashboard/GlobalScopePanel'
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
  countAlertsResolved,
  getCurrentUser,
  getProfessionalProfile,
  listAlerts,
  listClients,
  listPendingInvitesForCurrentUser,
  listRecentNotes,
  todaysMeasurements,
  trendMisurazioniMensile,
} from '@/lib/dashboard-data'
import { identificaCliente, ponteClienti } from '@/lib/client-bridge'
import { alertMessage, alertTypeLabel, alertValueDecimals, mergeAlerts } from '@/lib/alert-rules'
import { raggruppaAlert } from '@/lib/alert-group'
import { clientiAttivi } from '@/lib/home-metrics'
import { listAlertEvents } from '@/lib/alert-rules-server'
import { noteCategoryLabel } from '@/lib/types'
import { formatDate, formatGreeting, formatMeasuredTime, fullName, num, todayLong, daysSince } from '@/lib/format'
import { getLocale, getTranslations } from 'next-intl/server'
import { caricaOErrore } from '@/lib/data-error'
import { DataLoadNotice } from '@/components/dashboard/DataLoadNotice'

type Params = { params: { locale: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  // Il `title.template` di area-professionisti/layout.tsx vale per i segmenti
  // figli, non per la pagina index dello stesso segmento (Next applica il
  // template dell'ultimo layout solo sotto di esso): qui si applica a mano.
  return {
    title: { absolute: t('proArea.template').replace('%s', t('dashboardHome.title')) },
    robots: { index: false, follow: false },
  }
}

export const dynamic = 'force-dynamic'

export default async function DashboardHome() {
  // Vista globale del superadmin (data-scope.ts): conteggi di piattaforma,
  // nessuna riga dei clienti altrui.
  const { scope } = await getDataScope()
  if (scope === 'all') {
    const tScope = await getTranslations('dashboard.scope')
    return (
      <DashboardLayout professional={await getProfessionalProfile()}>
        <header className="mb-6">
          <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">{tScope('homeTitle')}</h1>
        </header>
        <GlobalScopePanel />
      </DashboardLayout>
    )
  }
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
  const [professional, cronAlerts, appEvents, measurements, contacts, trend, allClients, notes, invites, monitoring, alertsResolved, trendMensile] = await Promise.all([
    getProfessionalProfile(),
    // Attivi = `new` e `seen` (i `resolved` e i `duplicate` restano fuori). Se
    // ne leggono più dei 6 mostrati perché i doppioni si raggruppano dopo.
    listAlerts({ status: ['new', 'seen'], limit: 30 }),
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
    countAlertsResolved(7),
    trendMisurazioniMensile(),
  ])
  const recentMonitoring = filterMonitoringByModules(monitoring, await getMyAccountAccess()).slice(0, 5)
  // Gli alert identici (stesso cliente, tipo e valore) si mostrano una volta,
  // con il numero di ripetizioni e la data dell'ultimo.
  const alerts = raggruppaAlert(mergeAlerts(cronAlerts, appEvents)).slice(0, 6)

  const clientMap = new Map(allClients.map((c) => [c.id, c]))
  const totalClients = allClients.length
  const activeClients90 = clientiAttivi(allClients, 90)
  // Card "Trend": variazione delle misurazioni degli ultimi 30 giorni rispetto
  // ai 30 precedenti. "n.d." quando il mese precedente è a zero o la lettura
  // non è riuscita: il tooltip dice quale dei due. Mai "—".
  const variazione = trendMensile?.variazione ?? null
  const trendValue = variazione == null
    ? t('notAvailable')
    : `${variazione > 0 ? '+' : variazione < 0 ? '-' : ''}${num(Math.abs(variazione), 0, locale)}%`
  const trendClass = variazione == null ? 'text-anthracite-lighter' : variazione > 0 ? 'text-emerald-600' : variazione < 0 ? 'text-red-500' : 'text-anthracite'
  const trendTitle = trendMensile == null
    ? t('trendUnavailable')
    : trendMensile.variazione == null
      ? t('trendNoPreviousMonth')
      : t('trendTitle', { current: trendMensile.correnti, previous: trendMensile.precedenti })
  // Numeri estratti dai messaggi dell'app: si conservano i decimali che hanno
  // (0.45 → "0,45", 32 → "32"), al massimo due.
  const fmtNum = (v: number) => num(v, alertValueDecimals(v), locale)
  const alertOpts = { tScores, fmtDate: (d: Date) => formatDate(d, undefined, locale) }
  const clientName = (id: string) => {
    const c = clientMap.get(id)
    return (c && fullName(c)) || tc('client')
  }
  // Nome della scheda già caricata con la RLS, senza ripetere la query.
  const nomeScheda = (id: string) => {
    const c = clientMap.get(id)
    if (!c) return null
    return fullName(c) || tc('client')
  }
  // Il ponte dà il nome alle automisurazioni dei clienti collegati che
  // `todaysMeasurements` non ha potuto agganciare a una scheda.
  const ponte = user ? await ponteClienti(user.id) : { clientIdByUser: new Map(), profiloByUser: new Map() }

  return (
    <DashboardLayout professional={professional}>
      <InviteBanner invites={invites} />
      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          {formatGreeting(tGreeting)}, <em className="italic text-teal-dark">{professional?.nome ?? tc('professional')}</em>
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter">{todayLong(locale)}</p>
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
                {alerts.map(({ alert: a, count }) => {
                  const detail = alertMessage(a, tAlerts, fmtNum, alertOpts)
                  const quando = formatDate(a.created_at, undefined, locale)
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/area-professionisti/clienti/${a.client_id}`}
                        className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface transition-colors"
                      >
                        <AlertBadge severity={a.severity} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-anthracite truncate">{clientName(a.client_id)}</span>
                            {count > 1 && (
                              <span
                                className="inline-flex items-center px-1.5 h-5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 whitespace-nowrap"
                                title={tAlerts('group.title', { count, date: quando })}
                              >
                                {tAlerts('group.badge', { count })}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-anthracite-lighter mt-0.5">
                            {alertTypeLabel(a.type, tAlerts)}{detail ? ` · ${detail}` : ''} · {quando}
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
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Activity size={18} className="text-teal flex-shrink-0" />
                <h2 className="font-serif text-lg text-anthracite">{t('todaysMeasurements')}</h2>
                <span className="text-sm text-anthracite-lighter">({measurements.length})</span>
              </div>
              {/* La tabella mostra al massimo 10 righe: il resto sta nella lista
                  clienti filtrata su oggi. */}
              {measurements.length > 0 && (
                <Link href="/area-professionisti/clienti?periodo=oggi" className="text-sm text-teal-dark hover:underline whitespace-nowrap">{t('seeAllMeasurements')}</Link>
              )}
            </div>
            {measurements.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-anthracite-lighter">
                {t('noMeasurementsToday')}
              </div>
            ) : (
              <>
              {/* Mobile: card (F2). Da 640 px in su la tabella. */}
              <ul className="sm:hidden divide-y divide-surface-border">
                {measurements.slice(0, 10).map((m) => {
                  const chi = identificaCliente(m, ponte, nomeScheda, user?.id ?? null)
                  const href = chi.clientId
                    ? `/area-professionisti/clienti/${chi.clientId}/misurazione/${m.session_id}`
                    : '/area-professionisti/clienti'
                  return (
                    <li key={m.id}>
                      <Link href={href} className="block px-5 py-3 hover:bg-surface transition-colors">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-medium text-anthracite truncate">
                            {chi.kind === 'non_assegnata' ? <span className="text-anthracite-lighter italic">{t('unassignedMeasurement')}</span> : (chi.nome ?? tc('client'))}
                          </span>
                          <span className="text-xs text-anthracite-lighter whitespace-nowrap">{formatMeasuredTime(m, locale)}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                          <div><div className="text-[10px] uppercase tracking-wide text-anthracite-lighter">{tScores('names.stress')}</div><ScoreBar value={m.score_stress} scheme="stress" /></div>
                          <div><div className="text-[10px] uppercase tracking-wide text-anthracite-lighter">{tScores('names.recovery')}</div><ScoreBar value={m.score_recupero} scheme="recovery" /></div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <div className="hidden sm:block overflow-x-auto">
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
                      const chi = identificaCliente(m, ponte, nomeScheda, user?.id ?? null)
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
                                {chi.nome ?? tc('client')}
                                {chi.remota && (
                                  <span className="ml-2 text-[11px] font-normal text-teal-dark bg-teal-light rounded px-1.5 py-0.5 whitespace-nowrap">
                                    {t('remoteBadge')}
                                  </span>
                                )}
                                {chi.kind === 'profilo' && (
                                  <span className="ml-2 text-[11px] font-normal text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 whitespace-nowrap">
                                    {t('noCard')}
                                  </span>
                                )}
                              </>
                            )}
                          </LinkCell>
                          <LinkCell href={href} className="text-anthracite-lighter">{formatMeasuredTime(m, locale)}</LinkCell>
                          <LinkCell href={href} className="w-40"><ScoreBar value={m.score_stress} scheme="stress" /></LinkCell>
                          <LinkCell href={href} className="w-40"><ScoreBar value={m.score_recupero} scheme="recovery" /></LinkCell>
                          <LinkCell href={href} className="text-right">
                            <span className="text-teal-dark text-sm whitespace-nowrap">{tc('open')} →</span>
                          </LinkCell>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </>
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
            <MetricCard label={t('totalClients')} value={totalClients} hint={t('activeInDaysHint', { count: activeClients90, days: 90 })} />
            <MetricCard label={t('measurementsToday')} value={measurements.length} />
            <MetricCard
              label={t('alertsResolved')}
              value={alertsResolved ?? t('notAvailable')}
              hint={t('weekHint')}
              title={alertsResolved == null ? t('alertsResolvedUnavailable') : undefined}
            />
            <MetricCard label={t('trend')} value={trendValue} valueClassName={trendClass} hint={t('vsLastMonth')} title={trendTitle} />
          </div>

          <section className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-teal flex-shrink-0" />
              <h3 className="font-serif text-base text-anthracite">{t('aggregateTrend')}</h3>
            </div>
            {trend.ok ? (
              <AdvancedTrendChart
                daily={trend.data}
                defaultSelected={['score_stress', 'score_recupero', 'rmssd']}
                defaultPreset="30"
                height={170}
                storageKey="sx-home-trend"
                presets={['7', '30', '90', '180', '365']}
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
