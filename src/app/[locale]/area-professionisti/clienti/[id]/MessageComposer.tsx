'use client'

import { useState } from 'react'
import { Modal } from '@/components/dashboard/Modal'
import { createClient } from '@/lib/supabase-browser'
import type { Client, Message } from '@/lib/types'

type Props = {
  open: boolean
  onClose: () => void
  client: Client
  onSent?: (m: Message) => void
}

export function MessageComposer({ open, onClose, client, onSent }: Props) {
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  async function send() {
    setError(null)
    if (!subject.trim() || !content.trim()) {
      setError('Compila oggetto e contenuto')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // TODO: aggiungere channel="push" quando implementeremo notifiche app
    const { data, error: err } = await supabase
      .from('messages')
      .insert({
        professional_id: user.id,
        client_id: client.id,
        subject,
        content,
        channel: 'email',
        delivered: false,
      })
      .select()
      .maybeSingle()

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    // TODO: invocare Supabase Edge Function `send-message` che usa Resend
    // per la consegna effettiva dell'email al cliente.

    setLoading(false)
    if (data) onSent?.(data as Message)
    setSubject(''); setContent(''); setPreview(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invia messaggio"
      description={`Destinatario: ${client.nome ?? ''} ${client.cognome ?? ''} ${client.email ? `· ${client.email}` : ''}`.trim()}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setPreview((p) => !p)} className="btn-secondary text-sm">
            {preview ? 'Modifica' : 'Anteprima'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Annulla</button>
          <button type="button" onClick={send} disabled={loading} className="btn-primary text-sm">
            {loading ? 'Invio…' : 'Invia'}
          </button>
        </div>
      }
    >
      {preview ? (
        <div className="bg-surface p-5 rounded-xl">
          <div className="text-xs text-anthracite-lighter mb-2">Anteprima email</div>
          <div className="font-medium text-anthracite mb-3">{subject || '(senza oggetto)'}</div>
          <p className="text-sm text-anthracite whitespace-pre-wrap leading-relaxed">{content || '(vuoto)'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="input-label">Oggetto</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field" placeholder="Es. Promemoria misurazione settimanale" />
          </div>
          <div>
            <label className="input-label">Messaggio</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="input-field resize-y" placeholder={`Ciao ${client.nome ?? ''},\n\n…`} />
          </div>
          {error && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          <p className="text-xs text-anthracite-lighter">
            L&apos;invio email passa da una Edge Function dedicata (in arrivo). Per ora il messaggio viene archiviato in cronologia.
          </p>
        </div>
      )}
    </Modal>
  )
}
