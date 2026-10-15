'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, Merge, Search } from 'lucide-react'
import { formatDate } from '@/lib/format'
import type { DuplicateGroup } from '@/lib/admin-data'
import type { Toast } from './adminApi'
import { MergeClientsModal } from './MergeClientsModal'

// ============================================================================
// Tab "Possibili duplicati" del pannello Super Admin (audit QA 14/10, C10).
// Gruppi di schede `clients` non unite con stesso (nome, cognome, data di
// nascita) o stessa email, anche fra professionisti diversi, letti da
// GET /api/admin/clients/duplicates. Nessuna unione automatica: "Unisci" apre il
// MergeClientsModal già esistente (RPC lato DB, stesso professionista: per i
// gruppi trasversali prima si sposta la scheda dalla tab Clienti).
// ============================================================================

export function DuplicatesTab({
  groups,
  loadError,
  onChanged,
  showToast,
}: {
  groups: DuplicateGroup[]
  loadError: string | null
  onChanged: () => void
  showToast: (t: Toast) => void
}) {
  const t = useTranslations('admin.duplicates')
  const locale = useLocale()
  const [search, setSearch] = useState('')
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return groups
    return groups.filter((g) => g.clients.some((c) => `${c.full_name} ${c.email ?? ''} ${c.professional_name ?? ''}`.toLowerCase().includes(s)))
  }, [groups, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal" />
        </div>
        <div className="text-sm text-anthracite-lighter">{t('count', { count: filtered.length })}</div>
      </div>
      <p className="text-[13px] text-anthracite-lighter">{t('subtitle')}</p>

      {loadError && (
        <div className="callout-amber text-sm">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {!loadError && filtered.length === 0 && (
        <div className="card px-4 py-10 text-center text-sm text-anthracite-lighter">{t('empty')}</div>
      )}

      {filtered.map((g) => (
        <section key={g.key} className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-surface-border bg-surface">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-anthracite truncate">{`${g.nome ?? ''} ${g.cognome ?? ''}`.trim() || g.email || '—'}</div>
              <div className="text-xs text-anthracite-lighter truncate">
                {g.reason === 'name_birth' ? t('reasonName') : t('reasonEmail')}
                {g.data_nascita && <span> · {formatDate(g.data_nascita, undefined, locale)}</span>}
                {g.email && <span> · {g.email}</span>}
              </div>
            </div>
            {g.cross_professional && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap" title={t('crossProfessionalHint')}>
                <AlertTriangle size={11} /> {t('crossProfessional')}
              </span>
            )}
            <button type="button" onClick={() => setMergeGroup(g)} title={t('mergeHint')} className="inline-flex items-center gap-1 text-teal-dark hover:underline text-sm font-medium whitespace-nowrap">
              <Merge size={14} /> {t('merge')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-[12px] text-anthracite-lighter border-b border-surface-border">
                  <th className="px-4 py-2 font-normal">{t('thClient')}</th>
                  <th className="px-3 py-2 font-normal">{t('thBirth')}</th>
                  <th className="px-3 py-2 font-normal">{t('thEmail')}</th>
                  <th className="px-3 py-2 font-normal">{t('thProfessional')}</th>
                  <th className="px-3 py-2 font-normal text-right">{t('thMeasurements')}</th>
                  <th className="px-4 py-2 font-normal">{t('thLast')}</th>
                </tr>
              </thead>
              <tbody>
                {g.clients.map((c) => (
                  <tr key={c.id} className="border-t border-surface-border">
                    <td className="px-4 py-2 max-w-[240px]">
                      <div className="text-anthracite truncate">{c.full_name}</div>
                      <div className="text-[11px] text-anthracite-lighter font-mono truncate">{c.id}</div>
                    </td>
                    <td className="px-3 py-2 text-anthracite-lighter whitespace-nowrap">{c.data_nascita ? formatDate(c.data_nascita, undefined, locale) : '—'}</td>
                    <td className="px-3 py-2 text-anthracite-lighter max-w-[220px] truncate">{c.email ?? '—'}</td>
                    <td className="px-3 py-2 text-anthracite max-w-[200px] truncate">{c.professional_name ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-anthracite tabular-nums">{c.measurements_count}</td>
                    <td className="px-4 py-2 text-anthracite-lighter whitespace-nowrap">{c.last_measurement_at ? formatDate(c.last_measurement_at, undefined, locale) : t('never')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {mergeGroup && (
        <MergeClientsModal
          clients={mergeGroup.clients}
          onClose={() => setMergeGroup(null)}
          onChanged={() => { onChanged(); setMergeGroup(null) }}
          showToast={showToast}
        />
      )}
    </div>
  )
}
