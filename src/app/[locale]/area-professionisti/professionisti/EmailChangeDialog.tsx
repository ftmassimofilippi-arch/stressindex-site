'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { formatDate, formatRelative } from '@/lib/format'
import type { EmailChangePlan } from '@/lib/admin-account-email'
import { api, errorText, type Toast } from './adminApi'

// Correzione dell'email di un account auth in due passi: anteprima (conflitti
// e schede che cambiano) → conferma digitando la nuova email + motivo.
export function EmailChangeDialog({
  userId,
  currentEmail,
  onClose,
  onChanged,
  showToast,
}: {
  userId: string
  currentEmail: string | null
  onClose: () => void
  onChanged: () => void
  showToast: (t: Toast) => void
}) {
  const t = useTranslations('admin.emailChange')
  const ta = useTranslations('admin')
  const tc = useTranslations('common')
  const tErr = useTranslations('errors.api')
  const locale = useLocale()
  const [email, setEmail] = useState(currentEmail ?? '')
  const [plan, setPlan] = useState<EmailChangePlan | null>(null)
  const [confirm, setConfirm] = useState('')
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function preview() {
    setBusy('preview')
    setError(null)
    setPlan(null)
    const { ok, json } = await api('GET', `/api/admin/users/${userId}/email?email=${encodeURIComponent(email.trim())}`)
    setBusy(null)
    if (!ok) {
      setError(json?.error === 'same_email' ? t('errSame') : json?.error === 'invalid_email' ? t('errInvalid') : errorText(json, tErr))
      return
    }
    setPlan(json.plan as EmailChangePlan)
  }

  async function save() {
    if (!plan) return
    setBusy('save')
    const { ok, json } = await api('POST', `/api/admin/users/${userId}/email`, { email: plan.new_email, confirm, motivo })
    setBusy(null)
    if (!ok) {
      showToast({ kind: 'err', text: errorText(json, tErr, t('failed')) })
      return
    }
    showToast({ kind: 'ok', text: json?.partial ? t('partial') : t('done', { email: plan.new_email }) })
    onChanged()
    onClose()
  }

  const canSave = !!plan && !plan.conflict && confirm.trim().toLowerCase() === plan.new_email && motivo.trim().length > 0

  return (
    <Modal
      open
      onClose={onClose}
      title={t('title')}
      description={t('description', { email: currentEmail ?? '—' })}
      size="md"
      footer={
        <div className="flex justify-end gap-2 flex-wrap">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">{tc('cancel')}</button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave || busy === 'save'}
            className="text-sm px-5 py-2.5 rounded-xl font-medium bg-teal hover:bg-teal-dark text-white disabled:opacity-50"
          >
            {busy === 'save' ? ta('wait') : t('save')}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex gap-2">
          <input
            className="input-field flex-1 min-w-0"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setPlan(null) }}
            placeholder={t('placeholder')}
          />
          <button type="button" onClick={preview} disabled={busy === 'preview' || !email.trim()} className="btn-secondary text-sm whitespace-nowrap">
            {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : t('preview')}
          </button>
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}

        {plan && plan.conflict && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 space-y-1">
            <p className="font-medium inline-flex items-center gap-1.5"><AlertTriangle size={14} /> {t('conflictTitle')}</p>
            <p className="text-xs">
              {t('conflictDetails', {
                name: plan.conflict.full_name,
                role: plan.conflict.role && ta.has(`role.${plan.conflict.role}`) ? ta(`role.${plan.conflict.role}`) : plan.conflict.role ?? '—',
                created: plan.conflict.created_at ? formatDate(plan.conflict.created_at, undefined, locale) : '—',
                lastSignIn: plan.conflict.last_sign_in_at ? formatRelative(plan.conflict.last_sign_in_at, locale) : ta('never').toLowerCase(),
                sessions: plan.conflict.sessions,
                cardSessions: plan.conflict.card_sessions,
                links: plan.conflict.active_links,
              })}
            </p>
            <p className="text-xs">{t('conflictHelp')}</p>
          </div>
        )}

        {plan && !plan.conflict && (
          <>
            <div className="rounded-xl border border-surface-border p-3 space-y-2">
              <p className="inline-flex items-center gap-1.5 text-anthracite flex-wrap"><Mail size={14} /> {plan.old_email ?? '—'} → <b>{plan.new_email}</b></p>
              <p className="text-xs text-anthracite-lighter">{t('uidNote')}</p>
              {plan.cards_to_update.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-anthracite mb-1">{t('cardsToUpdate')}</p>
                  <ul className="text-xs text-anthracite-lighter space-y-0.5">
                    {plan.cards_to_update.map((c) => (
                      <li key={c.id} className="inline-flex items-center gap-1.5 w-full flex-wrap">
                        <CheckCircle2 size={12} className="text-green-600" />
                        {`${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || '—'} <span className="font-mono">{c.id}</span>
                        <span>({c.reason === 'ponte' ? t('reasonBridge') : t('reasonLink')})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-anthracite-lighter">{t('noCards')}</p>
              )}
              {plan.cards_not_touched.length > 0 && (
                <p className="text-xs text-amber-700 break-words">
                  {t('cardsNotTouched', { count: plan.cards_not_touched.length, ids: plan.cards_not_touched.map((c) => c.id).join(', ') })}
                </p>
              )}
            </div>
            <div>
              <label className="input-label">{t('reason')}</label>
              <input className="input-field" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t('reasonPlaceholder')} />
            </div>
            <div>
              <label className="input-label">{t.rich('typeToConfirm', { email: plan.new_email, b: (c) => <b>{c}</b> })}</label>
              <input className="input-field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
