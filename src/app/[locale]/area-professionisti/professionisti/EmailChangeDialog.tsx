'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { formatDate, formatRelative } from '@/lib/format'
import type { EmailChangePlan } from '@/lib/admin-account-email'
import { api, type Toast } from './adminApi'

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
      setError(json?.error === 'same_email' ? "È già l'email dell'account" : json?.error === 'invalid_email' ? 'Email non valida' : json?.error ?? 'Errore')
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
      showToast({ kind: 'err', text: json?.message ?? json?.error ?? 'Correzione non riuscita' })
      return
    }
    showToast({ kind: 'ok', text: json?.partial ? 'Email dell’account corretta, ma allineamento incompleto: vedi admin_audit_log' : `Email corretta in ${plan.new_email}` })
    onChanged()
    onClose()
  }

  const canSave = !!plan && !plan.conflict && confirm.trim().toLowerCase() === plan.new_email && motivo.trim().length > 0

  return (
    <Modal
      open
      onClose={onClose}
      title="Correggi l'email dell'account"
      description={`Attuale: ${currentEmail ?? '—'}. Login, reset password e inviti useranno la nuova email.`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Annulla</button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave || busy === 'save'}
            className="text-sm px-5 py-2.5 rounded-xl font-medium bg-teal hover:bg-teal-dark text-white disabled:opacity-50"
          >
            {busy === 'save' ? 'Attendere…' : 'Correggi email'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setPlan(null) }}
            placeholder="nuova@email.it"
          />
          <button type="button" onClick={preview} disabled={busy === 'preview' || !email.trim()} className="btn-secondary text-sm whitespace-nowrap">
            {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : 'Anteprima'}
          </button>
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}

        {plan && plan.conflict && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 space-y-1">
            <p className="font-medium inline-flex items-center gap-1.5"><AlertTriangle size={14} /> Email già usata da un altro account</p>
            <p className="text-xs">
              {plan.conflict.full_name} · ruolo {plan.conflict.role ?? '—'} · creato {plan.conflict.created_at ? formatDate(plan.conflict.created_at) : '—'} ·
              ultimo accesso {plan.conflict.last_sign_in_at ? formatRelative(plan.conflict.last_sign_in_at) : 'mai'} · {plan.conflict.sessions} misurazioni dall&apos;app ·
              {' '}{plan.conflict.card_sessions} sulle sue schede ·
              {' '}{plan.conflict.active_links} collegamenti attivi
            </p>
            <p className="text-xs">
              Due account per la stessa persona: la correzione non è possibile. Tieni l&apos;account che contiene i dati, revoca il
              collegamento dell&apos;altro e unisci le schede dalla tab Clienti.
            </p>
          </div>
        )}

        {plan && !plan.conflict && (
          <>
            <div className="rounded-xl border border-surface-border p-3 space-y-2">
              <p className="inline-flex items-center gap-1.5 text-anthracite"><Mail size={14} /> {plan.old_email ?? '—'} → <b>{plan.new_email}</b></p>
              <p className="text-xs text-anthracite-lighter">
                L&apos;uid non cambia: misurazioni, monitoraggi, baseline e collegamenti restano all&apos;account. Viene aggiornato anche profiles.email.
              </p>
              {plan.cards_to_update.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-anthracite mb-1">Schede allineate alla nuova email</p>
                  <ul className="text-xs text-anthracite-lighter space-y-0.5">
                    {plan.cards_to_update.map((c) => (
                      <li key={c.id} className="inline-flex items-center gap-1.5 w-full">
                        <CheckCircle2 size={12} className="text-green-600" />
                        {`${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || '—'} <span className="font-mono">{c.id}</span>
                        <span>({c.reason === 'ponte' ? 'agganciata all’account' : 'collegata per email'})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-anthracite-lighter">Nessuna scheda da allineare.</p>
              )}
              {plan.cards_not_touched.length > 0 && (
                <p className="text-xs text-amber-700">
                  {plan.cards_not_touched.length} schede con la vecchia email sotto professionisti senza collegamento restano invariate:{' '}
                  {plan.cards_not_touched.map((c) => c.id).join(', ')}
                </p>
              )}
            </div>
            <div>
              <label className="input-label">Motivo</label>
              <input className="input-field" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Es. refuso nel dominio (.con)" />
            </div>
            <div>
              <label className="input-label">Digita <b>{plan.new_email}</b> per confermare</label>
              <input className="input-field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
