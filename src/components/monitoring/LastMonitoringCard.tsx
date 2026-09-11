import Link from 'next/link'
import { ArrowRight, SunMoon } from 'lucide-react'
import type { MonitoringSession } from '@/lib/monitoring-types'
import { isSleepSession } from '@/lib/monitoring-types'
import { MON, duration, effectiveProfile, keyNumbers, periodLabel } from '@/lib/monitoring-format'
import { ProfileChip, TypeChip } from './MonitoringChips'
import { monitoringHref } from './MonitoringTable'

// Card "Ultimo monitoraggio" (Panoramica del cliente): data, profilo, i tre
// numeri chiave, apre il dettaglio.
export function LastMonitoringCard({ session, baseQuery = '' }: { session: MonitoringSession | null; baseQuery?: string }) {
  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2">
        <SunMoon size={16} style={{ color: MON.accent }} />
        <h3 className="font-serif text-base text-anthracite">Ultimo monitoraggio</h3>
      </div>
      {!session ? (
        <div className="px-5 py-6 text-sm text-anthracite-lighter text-center">Nessun monitoraggio</div>
      ) : (
        <Link href={monitoringHref(session, baseQuery)} className="block px-5 py-4 hover:bg-surface transition-colors">
          <div className="flex flex-wrap items-center gap-2">
            <TypeChip type={session.monitoring_type} size="sm" />
            {!isSleepSession(session) && (() => { const p = effectiveProfile(session); return <ProfileChip profile={p.profile} estimated={p.estimated} size="sm" /> })()}
            <span className="text-sm font-medium text-anthracite">{periodLabel(session.start_time, session.end_time, session.tz_offset_minutes)}</span>
            <span className="text-xs text-anthracite-lighter">· {duration(session.duration_minutes)}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {keyNumbers(session).map((n) => (
              <div key={n.label}>
                <div className="text-[10.5px] uppercase tracking-wide text-anthracite-lighter">{n.label}</div>
                <div className="font-serif text-xl tabular-nums" style={{ color: n.color }}>{n.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm inline-flex items-center gap-1" style={{ color: MON.accentDark }}>
            Apri il dettaglio <ArrowRight size={14} />
          </div>
        </Link>
      )}
    </section>
  )
}
