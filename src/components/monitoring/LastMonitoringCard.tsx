import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowRight, SunMoon } from 'lucide-react'
import type { MonitoringSession } from '@/lib/monitoring-types'
import { isSleepSession } from '@/lib/monitoring-types'
import { MON, duration, effectiveProfile, keyNumbers, periodLabel } from '@/lib/monitoring-format'
import { ProfileChip, TypeChip } from './MonitoringChips'
import { monitoringHref } from './MonitoringTable'

// Card "Ultimo monitoraggio" (Panoramica del cliente): data, profilo, i tre
// numeri chiave, apre il dettaglio.
export function LastMonitoringCard({ session, baseQuery = '' }: { session: MonitoringSession | null; baseQuery?: string }) {
  const t = useTranslations('monitoring')
  const locale = useLocale()
  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2">
        <SunMoon size={16} style={{ color: MON.accent }} />
        <h3 className="font-serif text-base text-anthracite">{t('lastCard.title')}</h3>
      </div>
      {!session ? (
        <div className="px-5 py-6 text-sm text-anthracite-lighter text-center">{t('table.empty')}</div>
      ) : (
        <Link href={monitoringHref(session, baseQuery)} className="block px-5 py-4 hover:bg-surface transition-colors">
          <div className="flex flex-wrap items-center gap-2">
            <TypeChip type={session.monitoring_type} size="sm" />
            {!isSleepSession(session) && (() => { const p = effectiveProfile(session); return <ProfileChip profile={p.profile} estimated={p.estimated} size="sm" /> })()}
            <span className="text-sm font-medium text-anthracite">{periodLabel(session.start_time, session.end_time, session.tz_offset_minutes, locale)}</span>
            <span className="text-xs text-anthracite-lighter">· {duration(session.duration_minutes)}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {keyNumbers(session, locale, t).map((n) => (
              <div key={n.label} className="min-w-0">
                <div className="text-[10.5px] uppercase tracking-wide text-anthracite-lighter truncate" title={n.label}>{n.label}</div>
                <div className="font-serif text-xl tabular-nums" style={{ color: n.color }}>{n.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm inline-flex items-center gap-1" style={{ color: MON.accentDark }}>
            {t('lastCard.open')} <ArrowRight size={14} />
          </div>
        </Link>
      )}
    </section>
  )
}
