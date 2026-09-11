'use client'

import Link from 'next/link'
import { ArrowRight, RefreshCw } from 'lucide-react'
import type { MonitoringSession } from '@/lib/monitoring-types'
import { isSleepSession } from '@/lib/monitoring-types'
import { duration, effectiveProfile, keyNumbers, periodLabel, sleepCoverageColor, sleepCoverageLabel } from '@/lib/monitoring-format'
import { Chip, ProfileChip, QualityChip, TypeChip } from './MonitoringChips'

// Lista compatta dei monitoraggi: una riga = cliente, data e ora di inizio,
// durata, chip tipo / profilo / qualità, i tre numeri chiave, link al
// dettaglio. Usata dalla pagina indice, dalla tab del cliente, dalla home.

export function monitoringHref(s: MonitoringSession, baseQuery = ''): string {
  return `/area-professionisti/monitoraggio/${s.id}${baseQuery}`
}

type Props = {
  sessions: MonitoringSession[]
  showClient?: boolean
  baseQuery?: string
  emptyText?: string
  compact?: boolean
}

export function MonitoringTable({ sessions, showClient = true, baseQuery = '', emptyText = 'Nessun monitoraggio', compact = false }: Props) {
  if (sessions.length === 0) {
    return <div className="px-6 py-8 text-center text-sm text-anthracite-lighter">{emptyText}</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-surface text-anthracite-lighter">
          <tr>
            {showClient && <Th>Cliente</Th>}
            <Th>Inizio</Th>
            <Th>Durata</Th>
            <Th>Tipo</Th>
            {!compact && <Th>Profilo</Th>}
            {!compact && <Th>Segnale</Th>}
            <Th>Numeri chiave</Th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const sleep = isSleepSession(s)
            const prof = sleep ? null : effectiveProfile(s)
            const nums = keyNumbers(s)
            const tz = s.tz_offset_minutes
            return (
              <tr key={s.id} className="border-t border-surface-border hover:bg-surface transition-colors align-middle">
                {showClient && (
                  <td className="px-4 py-3 font-medium text-anthracite whitespace-nowrap">
                    {s.client_id ? (
                      <Link href={`/area-professionisti/clienti/${s.client_id}${baseQuery}`} className="hover:underline">
                        {s.client_name ?? 'Cliente'}
                      </Link>
                    ) : (
                      <span className="text-anthracite-lighter">{s.client_name ?? '—'}</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-3 text-anthracite whitespace-nowrap">
                  <div>{periodLabel(s.start_time, s.end_time, tz)}</div>
                  {s.events_modified_on_web && (
                    <div className="text-[10.5px] text-amber-700 inline-flex items-center gap-1 mt-0.5">
                      <RefreshCw size={10} /> eventi in attesa di ricalcolo
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-anthracite whitespace-nowrap">{duration(s.duration_minutes)}</td>
                <td className="px-3 py-3"><TypeChip type={s.monitoring_type} size="sm" /></td>
                {!compact && (
                  <td className="px-3 py-3">
                    {prof ? <ProfileChip profile={prof.profile} estimated={prof.estimated} size="sm" /> : <span className="text-anthracite-lighter">—</span>}
                  </td>
                )}
                {!compact && (
                  <td className="px-3 py-3">
                    {sleep ? (
                      <Chip
                        label={`${sleepCoverageLabel(s.night?.sleep?.signal.coverage_label ?? null)}${s.night?.sleep ? ` · ${Math.round(s.night.sleep.signal.coverage_pct)}%` : ''}`}
                        color={sleepCoverageColor(s.night?.sleep?.signal.coverage_label ?? null)}
                        size="sm"
                      />
                    ) : (
                      <QualityChip quality={s.signal_quality} coverage={s.valid_coverage_percentage} size="sm" />
                    )}
                  </td>
                )}
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {nums.map((n) => (
                      <div key={n.label} className="whitespace-nowrap">
                        <span className="text-[10.5px] uppercase tracking-wide text-anthracite-lighter">{n.label}</span>
                        <span className="ml-1.5 font-semibold tabular-nums" style={{ color: n.color }}>{n.value}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <Link href={monitoringHref(s, baseQuery)} className="text-sm hover:underline inline-flex items-center gap-1" style={{ color: '#2B4160' }}>
                    Apri <ArrowRight size={14} />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium first:px-4">{children}</th>
}
