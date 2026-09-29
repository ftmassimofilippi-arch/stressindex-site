'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('messages.composer')
  const tCommon = useTranslations('common')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  async function send() {
    setError(null)
    if (!subject.trim() || !content.trim()) {
      setError(t('missingFields'))
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

  const recipient = `${client.nome ?? ''} ${client.cognome ?? ''} ${client.email ? `· ${client.email}` : ''}`.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('title')}
      description={t('recipient', { name: recipient })}
      size="lg"
      footer={
        <div className="flex justify-end gap-2 flex-wrap">
          <button type="button" onClick={() => setPreview((p) => !p)} className="btn-secondary text-sm">
            {preview ? t('edit') : t('preview')}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary text-sm">{tCommon('cancel')}</button>
          <button type="button" onClick={send} disabled={loading} className="btn-primary text-sm">
            {loading ? t('sending') : t('send')}
          </button>
        </div>
      }
    >
      {preview ? (
        <div className="bg-surface p-5 rounded-xl">
          <div className="text-xs text-anthracite-lighter mb-2">{t('previewLabel')}</div>
          <div className="font-medium text-anthracite mb-3">{subject || t('noSubject')}</div>
          <p className="text-sm text-anthracite whitespace-pre-wrap leading-relaxed">{content || t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="input-label">{t('subject')}</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field" placeholder={t('subjectPlaceholder')} />
          </div>
          <div>
            <label className="input-label">{t('body')}</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="input-field resize-y" placeholder={t('bodyPlaceholder', { name: client.nome ?? '' })} />
          </div>
          {error && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          <p className="text-xs text-anthracite-lighter">{t('note')}</p>
        </div>
      )}
    </Modal>
  )
}
