'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Merge, Search, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { api, errorText, type Toast } from './adminApi'
import type { AdminClientRow } from '@/lib/admin-data'

// Unione anagrafiche doppione: scegli la riga DA TENERE (radio) e una o più
// righe DA UNIRE (checkbox, solo dello stesso professionista). "Anteprima"
// mostra quante righe verranno spostate per ogni tabella (dry run della RPC),
// solo dopo si può eseguire — in una transazione unica lato DB.

// rows = riferimenti totali; moved = spostati sulla keep; conflict_deleted =
// ELIMINATI perché la keep ha già una riga equivalente (vincolo di unicità).
type PreviewTable = { table: string; column: string; rows: number; moved: number; conflict_deleted: number }

export function MergeClientsModal({
  clients,
  onClose,
  onChanged,
  showToast,
}: {
  clients: AdminClientRow[]
  onClose: () => void
  onChanged: () => void
  showToast: (t: Toast) => void
}) {
  const t = useTranslations('admin.merge')
  const tc = useTranslations('common')
  const tErr = useTranslations('errors.api')
  const [search, setSearch] = useState('')
  const [keepId, setKeepId] = useState<string | null>(null)
  const [mergeIds, setMergeIds] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<PreviewTable[] | null>(null)
  const [busy, setBusy] = useState<'preview' | 'merge' | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const keep = useMemo(() => clients.find((c) => c.id === keepId) ?? null, [clients, keepId])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return clients.filter((c) => !s || `${c.full_name} ${c.email ?? ''} ${c.professional_name ?? ''}`.toLowerCase().includes(s))
  }, [clients, search])

  function toggleMerge(id: string) {
    setPreview(null)
    setMergeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectKeep(id: string) {
    setPreview(null)
    setKeepId(id)
    // La riga da tenere non può essere anche tra quelle da unire.
    setMergeIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  async function loadPreview() {
    if (!keepId || mergeIds.size === 0) return
    setBusy('preview')
    const { ok, json } = await api('POST', '/api/admin/clients/merge', {
      keep_id: keepId,
      merge_ids: Array.from(mergeIds),
      dry_run: true,
    })
    setBusy(null)
    if (ok) setPreview((json?.result?.tables ?? []) as PreviewTable[])
    else showToast({ kind: 'err', text: errorText(json, tErr, t('previewError')) })
  }

  async function execute() {
    if (!keepId || mergeIds.size === 0) return
    setBusy('merge')
    const { ok, json } = await api('POST', '/api/admin/clients/merge', {
      keep_id: keepId,
      merge_ids: Array.from(mergeIds),
      dry_run: false,
    })
    setBusy(null)
    setConfirmOpen(false)
    if (ok) {
      const tables = (json?.result?.tables ?? []) as PreviewTable[]
      const moved = tables.reduce((a, tb) => a + (tb.moved ?? tb.rows), 0)
      const conflictDeleted = tables.reduce((a, tb) => a + (tb.conflict_deleted ?? 0), 0)
      showToast({
        kind: 'ok',
        text: t('done', {
          moved,
          conflict: conflictDeleted > 0 ? t('confirmConflict', { count: conflictDeleted }) : '',
          count: json?.result?.deleted_clients ?? mergeIds.size,
        }),
      })
      onChanged()
    } else {
      showToast({ kind: 'err', text: errorText(json, tErr, t('mergeError')) })
    }
  }

  const totalMoved = preview?.reduce((a, tb) => a + (tb.moved ?? tb.rows), 0) ?? 0
  const totalConflictDeleted = preview?.reduce((a, tb) => a + (tb.conflict_deleted ?? 0), 0) ?? 0

  return (
    <Modal
      open
      onClose={onClose}
      title={t('title')}
      description={t('description')}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2 w-full flex-wrap">
          <div className="text-xs text-anthracite-lighter min-w-0">
            {keep ? t.rich('keepSummary', { name: keep.full_name, count: mergeIds.size, b: (c) => <b className="text-anthracite">{c}</b> }) : t('selectKeep')}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-2">{tc('cancel')}</button>
            {!preview ? (
              <button
                type="button"
                onClick={loadPreview}
                disabled={!keepId || mergeIds.size === 0 || busy === 'preview'}
                className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} {t('preview')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={busy === 'merge'}
                className="text-sm px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {busy === 'merge' ? <Loader2 size={14} className="animate-spin" /> : <Merge size={14} />} {t('execute')}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />
        </div>

        <div className="rounded-xl border border-surface-border overflow-hidden">
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-surface text-anthracite-lighter sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium w-20">{t('thKeep')}</th>
                  <th className="px-3 py-2.5 text-left font-medium w-24">{t('thMerge')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('thClient')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('thProfessional')}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t('thMeasurements')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  // Le righe da unire devono appartenere allo stesso professionista
                  // della riga da tenere (la RPC lo impone comunque lato DB).
                  const mergeable = !keep || c.professionista_id === keep.professionista_id
                  return (
                    <tr key={c.id} className={`border-t border-surface-border ${c.id === keepId ? 'bg-teal-50/50' : mergeIds.has(c.id) ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-3 py-2">
                        <input type="radio" name="keep" checked={c.id === keepId} onChange={() => selectKeep(c.id)} />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={mergeIds.has(c.id)}
                          disabled={c.id === keepId || !mergeable}
                          onChange={() => toggleMerge(c.id)}
                          title={!mergeable ? t('otherProfessional') : undefined}
                        />
                      </td>
                      <td className="px-3 py-2 max-w-[240px]">
                        <div className="font-medium text-anthracite truncate">{c.full_name}</div>
                        <div className="text-xs text-anthracite-lighter truncate">{c.email ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-anthracite-lighter max-w-[200px] truncate">{c.professional_name ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-anthracite">{c.measurements_count}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-anthracite-lighter">{t('empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {preview && (
          <div className="rounded-xl border border-surface-border p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-anthracite-lighter mb-3">{t('previewTitle')}</h4>
            {preview.filter((tb) => tb.rows > 0).length === 0 ? (
              <p className="text-sm text-anthracite-lighter">{t('previewEmpty')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-anthracite-lighter">
                    <th className="py-1 font-medium">{t('thTable')}</th>
                    <th className="py-1 font-medium text-right">{t('thMoved')}</th>
                    <th className="py-1 font-medium text-right">{t('thConflict')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.filter((tb) => tb.rows > 0).map((tb) => (
                    <tr key={`${tb.table}.${tb.column}`} className="border-t border-surface-border">
                      <td className="py-1.5 text-anthracite-lighter">{tb.table}<span className="text-anthracite-lighter/60"> · {tb.column}</span></td>
                      <td className="py-1.5 text-right font-medium text-anthracite">{tb.moved ?? tb.rows}</td>
                      <td className={`py-1.5 text-right font-medium ${(tb.conflict_deleted ?? 0) > 0 ? 'text-red-500' : 'text-anthracite-lighter/50'}`}>
                        {tb.conflict_deleted ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3 pt-3 border-t border-surface-border space-y-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-anthracite-lighter">{t('totalMoved')}</span>
                <span className="font-medium text-anthracite">{totalMoved}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-anthracite-lighter">{t('totalConflict')}</span>
                <span className={`font-medium ${totalConflictDeleted > 0 ? 'text-red-500' : 'text-anthracite'}`}>{totalConflictDeleted}</span>
              </div>
            </div>
            {totalConflictDeleted > 0 && (
              <div className="callout-amber mt-3 text-xs">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                <span>{t('conflictWarning', { count: totalConflictDeleted })}</span>
              </div>
            )}
            <div className="callout-amber mt-3 text-xs">
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
              <span>{t('atomicWarning', { count: mergeIds.size })}</span>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={execute}
        title={t('confirmTitle')}
        description={t('confirmDescription', {
          moved: totalMoved,
          name: keep?.full_name ?? '',
          conflict: totalConflictDeleted > 0 ? t('confirmConflict', { count: totalConflictDeleted }) : '',
          count: mergeIds.size,
        })}
        confirmText={t('confirm')}
        destructive
        requireTypedConfirmation={t('typed')}
      />
    </Modal>
  )
}
