'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, EyeOff, HeartPulse, Link2, Loader2, Merge, RefreshCw, ShieldCheck, Wrench } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { formatDate } from '@/lib/format'
import type { AdminClientRow } from '@/lib/admin-data'
import { api, errorText, type Toast } from './adminApi'
import { MergeClientsModal } from './MergeClientsModal'

// ============================================================================
// Tab "Salute collegamenti" del pannello Super Admin.
// Legge la view v_collegamenti_salute (migration 020) via /api/admin/collegamenti
// e propone, per ogni riga, l'azione di riparazione: "Ripara" (con conferma)
// chiama la RPC indicata dalla view; "Unisci" apre il modale di unione schede.
// Il badge in alto viene dall'ultimo alert aperto scritto dal job settimanale.
// Le etichette dei tipi di problema (tipo_problema) stanno in admin.salute.types.
// ============================================================================

export type SaluteRow = {
  tipo_problema: string
  gravita: 'alta' | 'media' | 'bassa'
  client_id: string | null
  client_user_id: string | null
  professional_id: string | null
  link_id: string | null
  email: string | null
  nome: string | null
  professionista: string | null
  dettaglio: string | null
  fix_proposto: string | null
  fix_auto: boolean
  fix_rpc: string | null
  fix_args: Record<string, unknown>
}

type SaluteAlert = { id: number; total: number; details: Record<string, number>; created_at: string } | null

const TONE: Record<SaluteRow['gravita'], string> = {
  alta: 'bg-red-50 text-red-700 border-red-200',
  media: 'bg-amber-50 text-amber-700 border-amber-200',
  bassa: 'bg-surface text-anthracite-lighter border-surface-border',
}

type Pending = { row: SaluteRow; title: string; description: string; run: () => Promise<void> } | null

export function SaluteTab({ clients, onChanged, showToast }: { clients: AdminClientRow[]; onChanged: () => void; showToast: (t: Toast) => void }) {
  const t = useTranslations('admin.salute')
  const ta = useTranslations('admin')
  const tc = useTranslations('common')
  const tErr = useTranslations('errors.api')
  const locale = useLocale()
  const [rows, setRows] = useState<SaluteRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [alert, setAlert] = useState<SaluteAlert>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [mergeOpen, setMergeOpen] = useState<SaluteRow | null>(null)
  const [excludeRow, setExcludeRow] = useState<SaluteRow | null>(null)
  const [excludeReason, setExcludeReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const typeLabel = (tipo: string) => (t.has(`types.${tipo}`) ? t(`types.${tipo}`) : tipo)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { ok, json } = await api('GET', '/api/admin/collegamenti')
    if (json?.migration_required) {
      setMigrationRequired(true)
      setLoading(false)
      return
    }
    if (!ok) setError(errorText(json, tErr, ta('loadError')))
    setRows(json?.rows ?? [])
    setCounts(json?.counts ?? {})
    setAlert(json?.alert ?? null)
    setLoading(false)
  }, [tErr, ta])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => (filter ? rows.filter((r) => r.tipo_problema === filter) : rows), [rows, filter])
  const types = useMemo(() => Object.keys(counts).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)), [counts])

  async function runAction(row: SaluteRow, body: Record<string, unknown>, okText: string) {
    const key = `${row.tipo_problema}:${row.client_id ?? ''}:${row.client_user_id ?? ''}:${row.link_id ?? ''}`
    setBusy(key)
    const { ok, json } = await api('POST', '/api/admin/collegamenti', body)
    setBusy(null)
    if (!ok) {
      showToast({ kind: 'err', text: errorText(json, tErr, t('repairFailed')) })
      return
    }
    showToast({ kind: 'ok', text: okText })
    await load()
    onChanged()
  }

  function askRepair(row: SaluteRow) {
    const who = [row.nome, row.email].filter(Boolean).join(' · ') || row.client_id || row.client_user_id || ''
    if (row.fix_rpc === 'ensure_client_bridge') {
      setPending({
        row,
        title: t('bridgeTitle'),
        description: t('bridgeDescription', { who }),
        run: () => runAction(row, { action: 'bridge', email: row.email }, t('bridgeDone')),
      })
    } else if (row.fix_rpc === 'link_client_to_professional') {
      setPending({
        row,
        title: t('linkTitle'),
        description: t('linkDescription', { who, professional: row.professionista ?? row.professional_id ?? '' }),
        run: () => runAction(row, { action: 'link', client_user_id: row.client_user_id, professional_id: row.professional_id }, t('linkDone')),
      })
    } else if (row.fix_rpc === 'revoke_link') {
      setPending({
        row,
        title: t('revokeTitle'),
        description: t('revokeDescription', { who, link: row.link_id ?? '' }),
        run: () => runAction(row, { action: 'revoke_link', link_id: row.link_id }, t('revokeDone')),
      })
    } else if (row.fix_rpc === 'realign_analytics') {
      setPending({
        row,
        title: t('realignTitle'),
        description: t('realignDescription'),
        run: () => runAction(row, { action: 'realign_analytics' }, t('realignDone')),
      })
    }
  }

  // Candidato professionista per le sessioni remote invisibili: la view mette
  // in fix_args i professionisti che hanno una scheda con la stessa email.
  function remoteCandidates(row: SaluteRow): Array<{ professional_id: string; professionista: string; client_id: string }> {
    const c = row.fix_args?.candidati
    return Array.isArray(c) ? (c as Array<{ professional_id: string; professionista: string; client_id: string }>) : []
  }

  if (migrationRequired) {
    return (
      <div className="card p-6 text-sm text-anthracite-lighter flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-anthracite">{t('viewUnavailable')}</p>
          <p className="mt-1">{t('viewUnavailableHelp')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-anthracite inline-flex items-center gap-2">
            <HeartPulse size={18} className="text-teal" /> {t('title')}
          </h2>
          {alert ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200">
              <AlertTriangle size={13} className="flex-shrink-0" /> {t('weeklyCheck', { count: alert.total, date: formatDate(alert.created_at, undefined, locale) })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200">
              <ShieldCheck size={13} className="flex-shrink-0" /> {t('noAlert')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => runAction({ tipo_problema: 'check' } as SaluteRow, { action: 'check' }, t('checkDone'))}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-surface-border hover:bg-surface text-anthracite-lighter"
          >
            <Wrench size={15} /> {t('runCheck')}
          </button>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-surface-border hover:bg-surface text-anthracite-lighter disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} {ta('refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="callout-amber text-sm">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Conteggi per tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`card p-3 text-left text-sm flex items-center justify-between gap-2 ${filter === null ? 'ring-2 ring-teal' : ''}`}
        >
          <span className="text-anthracite">{t('allProblems')}</span>
          <span className="font-semibold text-anthracite">{rows.length}</span>
        </button>
        {types.map((tp) => (
          <button
            key={tp}
            type="button"
            onClick={() => setFilter(tp)}
            className={`card p-3 text-left text-sm flex items-center justify-between gap-2 ${filter === tp ? 'ring-2 ring-teal' : ''}`}
          >
            <span className="text-anthracite min-w-0">{typeLabel(tp)}</span>
            <span className="font-semibold text-anthracite flex-shrink-0">{counts[tp]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-12 flex items-center justify-center text-anthracite-lighter">
          <Loader2 className="animate-spin mr-2" size={18} /> {ta('loading')}
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center text-sm text-anthracite-lighter inline-flex items-center justify-center gap-2 w-full">
          <CheckCircle2 size={16} className="text-green-500" /> {t('noProblems')}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-xs text-anthracite-lighter border-b border-surface-border">
                <th className="px-3 py-2">{t('thSeverity')}</th>
                <th className="px-3 py-2">{t('thProblem')}</th>
                <th className="px-3 py-2">{t('thClient')}</th>
                <th className="px-3 py-2">{t('thProfessional')}</th>
                <th className="px-3 py-2">{t('thDetail')}</th>
                <th className="px-3 py-2">{t('thAction')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const key = `${r.tipo_problema}:${r.client_id ?? ''}:${r.client_user_id ?? ''}:${r.link_id ?? ''}`
                const isBusy = busy === key
                const candidates = r.tipo_problema === 'sessioni_remote_senza_link' ? remoteCandidates(r) : []
                return (
                  <tr key={`${key}:${i}`} className="border-b border-surface-border/60 align-top">
                    <td className="px-3 py-2">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-md border whitespace-nowrap ${TONE[r.gravita]}`}>{t.has(`severity.${r.gravita}`) ? t(`severity.${r.gravita}`) : r.gravita}</span>
                    </td>
                    <td className="px-3 py-2 text-anthracite">{typeLabel(r.tipo_problema)}</td>
                    <td className="px-3 py-2">
                      <div className="text-anthracite">{r.nome || '—'}</div>
                      <div className="text-xs text-anthracite-lighter break-all">{r.email ?? ''}</div>
                      {r.client_id && <div className="text-[11px] text-anthracite-lighter font-mono">{r.client_id}</div>}
                    </td>
                    <td className="px-3 py-2 text-anthracite">{r.professionista ?? (r.professional_id ? r.professional_id.slice(0, 8) : '—')}</td>
                    <td className="px-3 py-2">
                      <div className="text-anthracite-lighter">{r.dettaglio}</div>
                      <div className="text-xs text-anthracite mt-0.5">{r.fix_proposto}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.fix_rpc === 'admin_merge' ? (
                        <div className="flex flex-col gap-1">
                          <button type="button" onClick={() => setMergeOpen(r)} className="btn-secondary text-xs inline-flex items-center gap-1">
                            <Merge size={13} /> {t('merge')}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => { setExcludeReason(''); setExcludeRow(r) }}
                            title={t('doNotMergeHint')}
                            className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-lg text-anthracite-lighter hover:bg-surface disabled:opacity-50"
                          >
                            <EyeOff size={13} /> {t('doNotMerge')}
                          </button>
                        </div>
                      ) : r.fix_auto && r.fix_rpc ? (
                        <button type="button" disabled={isBusy} onClick={() => askRepair(r)} className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-50">
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Wrench size={13} />} {t('repair')}
                        </button>
                      ) : candidates.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {candidates.map((c) => (
                            <button
                              key={c.professional_id}
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                setPending({
                                  row: r,
                                  title: t('linkCandidateTitle'),
                                  description: t('linkCandidateDescription', { who: `${r.nome ?? ''} <${r.email ?? ''}>`, professional: c.professionista }),
                                  run: () => runAction(r, { action: 'link', client_user_id: r.client_user_id, professional_id: c.professional_id }, t('linkDone')),
                                })
                              }
                              className="btn-secondary text-xs inline-flex items-center gap-1"
                            >
                              <Link2 size={13} /> {t('linkTo', { name: c.professionista })}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-anthracite-lighter">{t('manual')}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.title ?? ''}
        description={pending?.description}
        confirmText={t('repair')}
        onConfirm={async () => {
          const p = pending
          setPending(null)
          if (p) await p.run()
        }}
      />

      <Modal
        open={!!excludeRow}
        onClose={() => setExcludeRow(null)}
        title={t('excludeTitle')}
        description={excludeRow ? `${excludeRow.nome ?? ''} · ${excludeRow.email ?? ''} · ${excludeRow.professionista ?? ''}` : undefined}
        size="sm"
        footer={
          <div className="flex justify-end gap-2 flex-wrap">
            <button type="button" onClick={() => setExcludeRow(null)} className="btn-secondary text-sm">{tc('cancel')}</button>
            <button
              type="button"
              disabled={!excludeReason.trim()}
              onClick={async () => {
                const r = excludeRow
                setExcludeRow(null)
                if (!r) return
                await runAction(
                  r,
                  { action: 'exclude_duplicate', professional_id: r.professional_id, email: r.email, client_ids: r.fix_args?.client_ids, motivo: excludeReason },
                  t('excludeDone'),
                )
              }}
              className="text-sm px-5 py-2.5 rounded-xl font-medium bg-teal hover:bg-teal-dark text-white disabled:opacity-50"
            >
              {tc('confirm')}
            </button>
          </div>
        }
      >
        <p className="text-sm text-anthracite-lighter mb-3">{t('excludeHelp')}</p>
        <label className="input-label">{t('excludeReason')}</label>
        <input
          className="input-field"
          value={excludeReason}
          onChange={(e) => setExcludeReason(e.target.value)}
          placeholder={t('excludeReasonPlaceholder')}
        />
      </Modal>

      {mergeOpen && (
        <MergeClientsModal
          clients={clients.filter((c) => {
            const ids = mergeOpen.fix_args?.client_ids
            return Array.isArray(ids) ? (ids as string[]).includes(c.id) : c.professionista_id === mergeOpen.professional_id
          })}
          onClose={() => setMergeOpen(null)}
          onChanged={() => {
            load()
            onChanged()
          }}
          showToast={showToast}
        />
      )}
    </div>
  )
}
