'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Check, CheckCircle2, Loader2, ShieldCheck, Users, X } from 'lucide-react'
import { apiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/format'
import { TRAINER_SHARE_DAYS, type TrainerShareCandidate } from '@/lib/trainer-share'

type Toast = { kind: 'ok' | 'err'; text: string } | null

// Chiave di selezione: la stringa vuota è "Le mie misurazioni" (client_id null).
const SELF = ''
const keyOf = (c: TrainerShareCandidate) => c.client_id ?? SELF

export function CondividiFormatoreView({
  initialCandidates,
  loadError,
  locale,
}: {
  initialCandidates: TrainerShareCandidate[]
  loadError: string | null
  locale: string
}) {
  const t = useTranslations('dashboard.trainerShare')
  const tc = useTranslations('common')
  const tErr = useTranslations('errors.api')
  const [candidates, setCandidates] = useState(initialCandidates)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<'share' | string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  const showToast = useCallback((next: Toast) => {
    setToast(next)
    if (next) setTimeout(() => setToast(null), 5000)
  }, [])

  const reload = useCallback(async () => {
    const res = await fetch('/api/trainer-share', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (res.ok && Array.isArray(json.candidates)) setCandidates(json.candidates)
  }, [])

  const self = candidates.find((c) => c.client_id === null) ?? null
  const clients = candidates.filter((c) => c.client_id !== null)
  const active = useMemo(() => candidates.filter((c) => c.share_id), [candidates])
  // Si può scegliere solo chi non è già condiviso: una condivisione attiva si
  // rinnova dopo la revoca, non si duplica.
  const selectable = candidates.filter((c) => !c.share_id)

  const toggle = (k: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  async function share() {
    if (selected.size === 0 || !consent || busy) return
    setBusy('share')
    const clientIds = Array.from(selected).map((k) => (k === SELF ? null : k))
    const res = await fetch('/api/trainer-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientIds, consent: true }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (res.ok) {
      showToast({ kind: 'ok', text: t('toast.shared', { count: clientIds.length }) })
      setSelected(new Set())
      setConsent(false)
    } else {
      showToast({ kind: 'err', text: apiErrorMessage(json, tErr) })
    }
    await reload()
  }

  async function revoke(c: TrainerShareCandidate) {
    if (!c.share_id || busy) return
    setBusy(c.share_id)
    const res = await fetch('/api/trainer-share', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: c.share_id }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (res.ok) showToast({ kind: 'ok', text: t('toast.revoked') })
    else showToast({ kind: 'err', text: apiErrorMessage(json, tErr) })
    await reload()
  }

  const nameOf = (c: TrainerShareCandidate) =>
    c.client_id === null ? t('myMeasurements') : `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || tc('client')

  const Row = ({ c }: { c: TrainerShareCandidate }) => {
    const k = keyOf(c)
    const checked = selected.has(k)
    const disabled = !!c.share_id
    return (
      <li>
        <label
          className={`flex items-start gap-3 px-5 py-3.5 transition-colors ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-surface'}`}
        >
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-surface-border text-teal focus:ring-teal"
            checked={checked}
            disabled={disabled}
            onChange={() => toggle(k)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-anthracite">{nameOf(c)}</span>
              <span className="text-xs text-anthracite-lighter">{t('measurementsCount', { count: c.n_misurazioni })}</span>
              {disabled && (
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-teal-light text-teal-dark">{t('alreadyShared')}</span>
              )}
            </div>
            <div className="text-xs text-anthracite-lighter mt-0.5">
              {t('preview', { code: c.case_code ?? t('noCode') })}
            </div>
          </div>
        </label>
      </li>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-6">
        <section className="card p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="text-teal-dark flex-shrink-0 mt-0.5" />
            <p className="text-sm text-anthracite leading-relaxed">{t('consentText')}</p>
          </div>
        </section>

        {loadError && (
          <div className="callout-amber text-sm">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
            <span>{t('loadError')}</span>
          </div>
        )}

        {!loadError && (
          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2">
              <Users size={18} className="text-teal flex-shrink-0" />
              <h2 className="font-serif text-lg text-anthracite">{t('chooseTitle')}</h2>
            </div>
            <ul className="divide-y divide-surface-border">
              {self && <Row c={self} />}
              {clients.map((c) => <Row key={c.client_id} c={c} />)}
            </ul>
            {clients.length === 0 && (
              <p className="px-5 py-4 text-sm text-anthracite-lighter border-t border-surface-border">{t('noClients')}</p>
            )}
            <div className="px-5 py-4 border-t border-surface-border bg-surface/60 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-surface-border text-teal focus:ring-teal"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span className="text-sm text-anthracite">{t('confirmLabel')}</span>
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={share}
                  disabled={selected.size === 0 || !consent || busy !== null || selectable.length === 0}
                  className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {busy === 'share' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {t('shareButton')}
                </button>
                <span className="text-xs text-anthracite-lighter">{t('selectedCount', { count: selected.size })}</span>
              </div>
            </div>
          </section>
        )}
      </div>

      <aside className="lg:col-span-5 space-y-6">
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <h2 className="font-serif text-lg text-anthracite">{t('activeTitle')}</h2>
            <p className="text-xs text-anthracite-lighter mt-0.5">{t('activeIntro', { days: TRAINER_SHARE_DAYS })}</p>
          </div>
          {active.length === 0 ? (
            <p className="px-5 py-6 text-sm text-anthracite-lighter text-center">{t('noActive')}</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {active.map((c) => (
                <li key={c.share_id} className="px-5 py-3.5 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-anthracite truncate">{nameOf(c)}</div>
                    <div className="text-xs text-anthracite-lighter mt-0.5">
                      {t('preview', { code: c.case_code ?? t('noCode') })}
                      {c.share_expires_at ? ` · ${t('expires', { date: formatDate(c.share_expires_at, undefined, locale) })}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => revoke(c)}
                    disabled={busy !== null}
                    className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                  >
                    {busy === c.share_id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    {t('revoke')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="text-xs text-anthracite-lighter px-1">{t('footnote')}</p>
      </aside>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-card text-sm text-white ${toast.kind === 'ok' ? 'bg-teal-dark' : 'bg-red-600'}`}
        >
          {toast.kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.text}
        </div>
      )}
    </div>
  )
}
