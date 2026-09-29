'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Send, Mail } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { MessageComposer } from '../MessageComposer'
import { formatDateTime } from '@/lib/format'
import type { Client, Message } from '@/lib/types'

export function MessagesTab({ client, initialMessages }: { client: Client; initialMessages: Message[] }) {
  const t = useTranslations('messages.tab')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(initialMessages)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-anthracite-lighter">{t('history')}</p>
        <button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm inline-flex items-center gap-1.5">
          <Send size={15} /> {t('sendNew')}
        </button>
      </div>

      {messages.length === 0 ? (
        <div className="card">
          <EmptyState icon={Mail} title={t('emptyTitle')} description={t('emptyBody')} action={{ label: t('send'), onClick: () => setOpen(true) }} />
        </div>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-surface text-anthracite-lighter">
                    {m.channel === 'email' ? t('channelEmail') : t('channelPush')}
                  </span>
                  <span className="text-xs text-anthracite-lighter">{formatDateTime(m.sent_at, locale)}</span>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${m.delivered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {m.delivered ? t('delivered') : t('queued')}
                </span>
              </div>
              {m.subject && <div className="font-medium text-anthracite mb-1">{m.subject}</div>}
              {m.content && <p className="text-sm text-anthracite whitespace-pre-wrap leading-relaxed">{m.content}</p>}
            </li>
          ))}
        </ul>
      )}

      <MessageComposer
        open={open}
        onClose={() => setOpen(false)}
        client={client}
        onSent={(m) => setMessages((arr) => [m, ...arr])}
      />
    </div>
  )
}
