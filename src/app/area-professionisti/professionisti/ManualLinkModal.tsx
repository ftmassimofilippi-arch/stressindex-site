'use client'

import { useState } from 'react'
import { CheckCircle2, Info, Link2, Loader2 } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { api, type Toast } from './adminApi'

// Aggancio manuale cliente↔professionista via email. Crea (o riattiva) il link
// in client_professional_links valorizzando client_user_id; la riga CRM viene
// creata dal trigger DB alla transizione ad 'active'. Se il link esiste già
// attivo, mostra lo stato attuale invece di creare un doppione.

type Result = {
  status: 'created' | 'reactivated' | 'already_active'
  client_role: string | null
  crm_client: { id: string; nome: string | null; cognome: string | null; email: string | null } | null
}

export function ManualLinkModal({
  professionals,
  onClose,
  onChanged,
  showToast,
}: {
  professionals: Array<{ id: string; name: string; email: string | null }>
  onClose: () => void
  onChanged: () => void
  showToast: (t: Toast) => void
}) {
  const [email, setEmail] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal'

  async function submit() {
    if (!email.trim() || !professionalId) return
    setBusy(true)
    const { ok, json } = await api('POST', '/api/admin/links/manual', {
      client_email: email.trim(),
      professional_id: professionalId,
    })
    setBusy(false)
    if (!ok) {
      showToast({ kind: 'err', text: json?.message ?? json?.error ?? 'Errore collegamento' })
      return
    }
    setResult(json as Result)
    if (json.status !== 'already_active') onChanged()
  }

  const statusLabel: Record<Result['status'], string> = {
    created: 'Collegamento creato e attivo',
    reactivated: 'Collegamento esistente riattivato',
    already_active: 'Collegamento già attivo: nessuna modifica',
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Collega cliente a professionista"
      description="Inserisci l'email con cui il cliente ha creato il suo account. La scheda CRM viene creata o agganciata in automatico."
      size="md"
      footer={
        result ? (
          <div className="flex justify-end"><button type="button" onClick={onClose} className="btn-secondary text-sm py-2">Chiudi</button></div>
        ) : (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-2">Annulla</button>
            <button
              type="button"
              onClick={submit}
              disabled={!email.trim() || !professionalId || busy}
              className="text-sm px-5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Collega
            </button>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <div className={`flex items-start gap-2.5 text-sm rounded-xl border p-3.5 ${result.status === 'already_active' ? 'border-surface-border bg-surface/60 text-anthracite' : 'border-green-200 bg-green-50/60 text-anthracite'}`}>
            {result.status === 'already_active' ? <Info size={16} className="text-anthracite-lighter mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />}
            <div>
              <div className="font-medium">{statusLabel[result.status]}</div>
              {result.crm_client ? (
                <div className="text-xs text-anthracite-lighter mt-1">
                  Scheda CRM: {`${result.crm_client.nome ?? ''} ${result.crm_client.cognome ?? ''}`.trim() || result.crm_client.email || result.crm_client.id}
                </div>
              ) : (
                <div className="text-xs text-amber-600 mt-1">
                  Nessuna scheda CRM trovata dopo l&apos;operazione: verifica il trigger tg_create_client_on_active_link.
                </div>
              )}
              {result.client_role === 'professional' && (
                <div className="text-xs text-amber-600 mt-1">Nota: questo utente ha ruolo professionista, non cliente.</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="input-label">Email account cliente</label>
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@esempio.it" />
          </div>
          <div>
            <label className="input-label">Professionista</label>
            <select className={inputCls} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">Seleziona…</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.email ? ` (${p.email})` : ''}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-anthracite-lighter">
            Il link viene creato con <code className="px-1 bg-surface rounded">client_user_id</code> (mai <code className="px-1 bg-surface rounded">client_id</code>).
            Se esiste un link revocato o in attesa per la stessa coppia, viene riattivato.
          </p>
        </div>
      )}
    </Modal>
  )
}
