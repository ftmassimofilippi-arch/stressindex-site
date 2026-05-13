import Link from 'next/link'
import { Activity, AlertTriangle, ArrowRight, Calendar, FileText, NotebookPen, TrendingUp, UserCheck, Users } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { AlertBadge } from '@/components/dashboard/AlertBadge'
import { ScoreBar } from '@/components/dashboard/ScoreBar'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { aggregatedDailyAverages, clientsToContact, getProfessionalProfile, listAlerts, listClients, listRecentNotes, todaysSessions } from '@/lib/dashboard-data'
import { ALERT_TYPE_LABEL } from '@/lib/types'
import { formatGreeting, formatTime, todayLongIt, daysSince } from '@/lib/format'

export const metadata = { title: 'Oggi' }
export const dynamic = 'force-dynamic'

export default async function DashboardHome() {
  const [professional, alerts, sessions, contacts, trend, allClients, notes] = await Promise.all([
    getProfessionalProfile(),
    listAlerts({ status: ['new', 'seen'], limit: 5 }),
    todaysSessions(),
    clientsToContact(),
    aggregatedDailyAverages(30),
    listClients(),
    listRecentNotes(3),
  ])

  const clientMap = new Map(allClients.map((c) => [c.id, c]))
  const newAlertCount = alerts.filter((a) => a.status === 'new').length

  // Statistiche rapide
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const lastMonthStart = new Date(monthStart); lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
  const totalActive = allClients.length

  return (
    <DashboardLayout professional={professional} alertCount={newAlertCount}>
      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl text-anthracite">
          {formatGreeting()}, <em className="italic text-teal-dark">{professional?.nome ?? 'Dottore'}</em>
        </h1>
        <p className="mt-1.5 text-sm text-anthracite-lighter capitalize">{todayLongIt()}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonna 1+2 */}
        <div className="lg:col-span-8 space-y-6">

          {/* Alert prioritari */}
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                <h2 className="font-serif text-lg text-anthracite">Alert prioritari</h2>
              </div>
              <Link href="/area-professionisti/clienti" className="text-sm text-teal-dark hover:underline">Vedi tutti</Link>
            </div>
            {alerts.length === 0 ? (
              <EmptyState icon={UserCheck} title="Nessun alert oggi" description="Tutto sotto controllo." />
            ) : (
              <ul className="divide-y divide-surface-border">
                {alerts.map((a) => {
                  const c = clientMap.get(a.client_id)
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/area-professionisti/clienti/${a.client_id}`}
                        className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface transition-colors"
                      >
                        <AlertBadge severity={a.severity} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-anthracite">
                            {c ? `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() : 'Cliente'}
                          </div>
                          <div className="text-xs text-anthracite-lighter mt-0.5">
                            {ALERT_TYPE_LABEL[a.type]}{a.triggering_value != null ? ` · valore ${Math.round(a.triggering_value)}` : ''}
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-anthracite-lighter" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Misurazioni di oggi */}
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-teal" />
                <h2 className="font-serif text-lg text-anthracite">Misurazioni di oggi</h2>
                <span className="text-sm text-anthracite-lighter">({sessions.length})</span>
              </div>
            </div>
            {sessions.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-anthracite-lighter">
                Nessuna misurazione registrata oggi
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-anthracite-lighter">
                    <tr>
                      <th className="text-left px-6 py-2.5 text-[11px] uppercase tracking-wide font-medium">Cliente</th>
                      <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Ora</th>
                      <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Stress</th>
                      <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Recupero</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.slice(0, 10).map((s) => {
                      const c = clientMap.get(s.client_id)
                      return (
                        <tr key={s.id} className="border-t border-surface-border hover:bg-surface transition-colors">
                          <td className="px-6 py-3 font-medium text-anthracite">
                            {c ? `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() : '—'}
                          </td>
                          <td className="px-3 py-3 text-anthracite-lighter">{formatTime(s.created_at)}</td>
                          <td className="px-3 py-3 w-40"><ScoreBar value={s.stress_score} inverted /></td>
                          <td className="px-3 py-3 w-40"><ScoreBar value={s.recovery_score} /></td>
                          <td className="px-3 py-3 text-right">
                            <Link href={`/area-professionisti/clienti/${s.client_id}/misurazione/${s.id}`} className="text-teal-dark text-sm hover:underline">
                              Apri →
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Da contattare */}
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-anthracite" />
                <h2 className="font-serif text-lg text-anthracite">Da contattare</h2>
              </div>
            </div>
            {contacts.length === 0 ? (
              <EmptyState icon={UserCheck} title="Nessun cliente da risollecitare" description="Tutti i tuoi clienti misurano regolarmente." />
            ) : (
              <ul className="divide-y divide-surface-border">
                {contacts.map((c) => (
                  <li key={c.client.id} className="px-6 py-3.5 flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-anthracite">{c.client.nome} {c.client.cognome}</div>
                      <div className="text-xs text-anthracite-lighter mt-0.5">
                        Ultima misurazione {c.daysSinceLast} giorni fa
                      </div>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                      {c.daysSinceLast}gg
                    </span>
                    <Link href={`/area-professionisti/clienti/${c.client.id}?tab=messaggi`} className="text-teal-dark text-sm hover:underline">
                      Promemoria →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Colonna 3 */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Clienti attivi" value={totalActive} hint="totali" />
            <MetricCard label="Mis. mese" value={sessions.length} hint="oggi" />
            <MetricCard label="Alert risolti" value="—" hint="settimana" />
            <MetricCard label="Trend" value="—" hint="vs mese scorso" />
          </div>

          <section className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-teal" />
              <h3 className="font-serif text-base text-anthracite">Andamento medio · 30 giorni</h3>
            </div>
            <TrendChart data={trend} height={200} />
          </section>

          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2">
              <NotebookPen size={16} className="text-anthracite" />
              <h3 className="font-serif text-base text-anthracite">Ultime note</h3>
            </div>
            {notes.length === 0 ? (
              <div className="px-5 py-6 text-sm text-anthracite-lighter text-center">Nessuna nota recente</div>
            ) : (
              <ul className="divide-y divide-surface-border">
                {notes.map((n) => {
                  const c = clientMap.get(n.client_id)
                  return (
                    <li key={n.id} className="px-5 py-3">
                      <Link href={`/area-professionisti/clienti/${n.client_id}?tab=note`} className="block hover:bg-surface -mx-5 px-5 py-1 transition-colors">
                        <div className="text-xs font-medium text-anthracite-lighter mb-0.5">
                          {c ? `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() : 'Cliente'} · {daysSince(n.created_at)}gg fa
                        </div>
                        <p className="text-sm text-anthracite line-clamp-2">{n.content}</p>
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
