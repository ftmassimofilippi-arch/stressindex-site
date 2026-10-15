'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import { formatDurationHuman, measurementTypeShortLabel } from '@/lib/measurement-type'
import type { UnassignedSession } from '@/lib/admin-data'
import { api, errorText } from './adminApi'

// ============================================================================
// Tab "Senza scheda" del pannello Super Admin (audit QA 14/10, C10).
// Misurazioni `sessions` con client_id nullo negli ultimi N giorni, da
// GET /api/admin/sessions/unassigned?days=N. Solo elenco, nessuna azione: il
// link apre la misurazione nella scheda deducibile (vista superadmin in sola
// lettura del titolare), quando esiste.
// ============================================================================

const DAY_OPTIONS = [7, 30, 90, 365]

type RoleFilter = 'all' | 'client' | 'professional'

export function UnassignedTab({ initial, initialDays, loadError }: { initial: UnassignedSession[]; initialDays: number; loadError: string | null }) {
  const t = useTranslations('admin.unassigned')
  const tTypes = useTranslations('measurement.types')
  const tErr = useTranslations('errors.api')
  const locale = useLocale()
  const [days, setDays] = useState(initialDays)
  const [rows, setRows] = useState<UnassignedSession[]>(initial)
  const [error, setError] = useState<string | null>(loadError)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<RoleFilter>('all')

  // Il periodo iniziale arriva già caricato dal pannello; un altro periodo si
  // chiede alla route.
  useEffect(() => {
    if (days === initialDays) { setRows(initial); setError(loadError); return }
    let alive = true
    setLoading(true)
    api('GET', `/api/admin/sessions/unassigned?days=${days}`).then(({ ok, json }) => {
      if (!alive) return
      if (ok) { setRows(json?.sessions ?? []); setError(null) }
      else setError(errorText(json, tErr, t('loadError')))
      setLoading(false)
    })
    return () => { alive = false }
  }, [days, initial, initialDays, loadError, t, tErr])

  const filtered = useMemo(() => rows.filter((r) => role === 'all' || r.account_role === role), [rows, role])
  const nClient = rows.filter((r) => r.account_role === 'client').length
  const nProfessional = rows.filter((r) => r.account_role === 'professional').length

  const roleLabel = (r: UnassignedSession['account_role']) => (r === 'client' ? t('roleClient') : r === 'professional' ? t('roleProfessional') : t('roleUnknown'))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30">
          {DAY_OPTIONS.map((d) => <option key={d} value={d}>{t('daysOption', { days: d })}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value as RoleFilter)} className="px-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30">
          <option value="all">{t('roleAll', { count: rows.length })}</option>
          <option value="client">{t('roleClientOption', { count: nClient })}</option>
          <option value="professional">{t('roleProfessionalOption', { count: nProfessional })}</option>
        </select>
        <div className="text-sm text-anthracite-lighter inline-flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin" />}
          {t('count', { count: filtered.length })}
        </div>
      </div>
      <p className="text-[13px] text-anthracite-lighter">{t('subtitle')}</p>

      {error && (
        <div className="callout-amber text-sm">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-anthracite-lighter border-b border-surface-border bg-surface">
                <th className="px-4 py-3 font-medium">{t('thDate')}</th>
                <th className="px-3 py-3 font-medium">{t('thAccount')}</th>
                <th className="px-3 py-3 font-medium">{t('thType')}</th>
                <th className="px-3 py-3 font-medium text-right">{t('thDuration')}</th>
                <th className="px-3 py-3 font-medium">{t('thClientName')}</th>
                <th className="px-4 py-3 font-medium">{t('thCard')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-surface-border hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3 text-anthracite whitespace-nowrap">{s.started_at ? formatDateTime(s.started_at, locale) : '—'}</td>
                  <td className="px-3 py-3 max-w-[260px]">
                    <div className="text-anthracite truncate">{s.professional_name ?? s.professional_email ?? '—'}</div>
                    <div className="text-[11px] text-anthracite-lighter truncate">{roleLabel(s.account_role)}{s.professional_email && s.professional_name ? ` · ${s.professional_email}` : ''}</div>
                  </td>
                  <td className="px-3 py-3 text-anthracite-lighter whitespace-nowrap">{measurementTypeShortLabel(s.test_type, tTypes)}</td>
                  <td className="px-3 py-3 text-right text-anthracite tabular-nums whitespace-nowrap">{formatDurationHuman(s.duration_seconds)}</td>
                  <td className="px-3 py-3 text-anthracite max-w-[200px] truncate">{s.client_nome ?? '—'}</td>
                  <td className="px-4 py-3">
                    {/* Solo il nome della scheda dedotta, senza link: la vista sui dati
                        di un altro professionista è spenta (superadmin-scope.ts). */}
                    {s.deduced_client_id ? (
                      <span className="text-sm text-anthracite" title={t('openHint', { name: s.deduced_client_name ?? '' })}>
                        {s.deduced_client_name ?? t('open')}
                      </span>
                    ) : (
                      <span className="text-xs text-anthracite-lighter">{t('noCard')}</span>
                    )}
                  </td>
                </tr>
              ))}
              {!error && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-anthracite-lighter">{t('empty')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
