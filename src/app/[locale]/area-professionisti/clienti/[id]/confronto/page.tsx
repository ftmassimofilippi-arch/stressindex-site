import { Link } from '@/i18n/navigation'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { MeasurementTypeBadge } from '@/components/dashboard/MeasurementTypeBadge'
import { getClient, getMeasurementBySessionId, getProfessionalProfile, listAlerts } from '@/lib/dashboard-data'
import { fullName, formatMeasuredAt } from '@/lib/format'
import { PoincareScatter } from '../misurazione/[sessionId]/HrvCharts'
import { ComparisonTable } from './ComparisonTable'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Confronto misurazioni' }

// Confronto fra DUE sessioni (prima → dopo): i cinque score, i parametri HRV
// principali e i due Poincaré affiancati sulla stessa scala fissa. Aperto
// dalla sezione "Prima e dopo" della scheda cliente, ma accetta qualsiasi
// coppia di sessioni via ?a=&b=.
export default async function ComparisonPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { a?: string; b?: string; professionista?: string }
}) {
  const a = searchParams?.a
  const b = searchParams?.b
  if (!a || !b) notFound()

  const [client, professional, alerts, ma, mb] = await Promise.all([
    getClient(params.id),
    getProfessionalProfile(),
    listAlerts({ status: ['new'] }),
    getMeasurementBySessionId(a, params.id),
    getMeasurementBySessionId(b, params.id),
  ])
  if (!client || !ma || !mb) notFound()

  const qs = searchParams?.professionista ? `?professionista=${searchParams.professionista}` : ''
  const backHref = `/area-professionisti/clienti/${client.id}${qs}${qs ? '&' : '?'}tab=prima-dopo`

  return (
    <DashboardLayout professional={professional} alertCount={alerts.length}>
      <div className="mb-6">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite transition-colors">
          <ArrowLeft size={14} /> {fullName(client)} · Prima e dopo
        </Link>
      </div>

      <header className="card p-6 mb-6">
        <h1 className="font-serif text-2xl text-anthracite">Confronto <em className="italic">prima → dopo</em></h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {[{ label: 'Prima', m: ma }, { label: 'Dopo', m: mb }].map(({ label, m }) => (
            <div key={label} className="rounded-xl border border-surface-border bg-surface px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">{label}</div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-sm font-medium text-anthracite">{formatMeasuredAt(m)}</span>
                <MeasurementTypeBadge testType={m.test_type} size="sm" />
              </div>
              <Link href={`/area-professionisti/clienti/${client.id}/misurazione/${m.session_id}${qs}`} className="text-xs text-teal-dark hover:underline mt-1 inline-block">
                Apri la misurazione →
              </Link>
            </div>
          ))}
        </div>
      </header>

      <ComparisonTable a={ma} b={mb} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="card p-6">
          <h3 className="font-serif text-base text-anthracite mb-1">Poincaré · prima</h3>
          <p className="text-xs text-anthracite-lighter mb-3">Stessa scala fissa dei due grafici: le due nuvole si confrontano a vista</p>
          <PoincareScatter rr={ma.rr_intervals ?? null} sd1={ma.sd1} sd2={ma.sd2} />
        </div>
        <div className="card p-6">
          <h3 className="font-serif text-base text-anthracite mb-1">Poincaré · dopo</h3>
          <p className="text-xs text-anthracite-lighter mb-3">&nbsp;</p>
          <PoincareScatter rr={mb.rr_intervals ?? null} sd1={mb.sd1} sd2={mb.sd2} />
        </div>
      </section>
    </DashboardLayout>
  )
}
