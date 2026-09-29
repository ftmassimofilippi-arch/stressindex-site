'use client'

import { useState } from 'react'
import { Send, Mail } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { MessageComposer } from '../MessageComposer'
import { formatDateTime } from '@/lib/format'
import type { Client, Message } from '@/lib/types'

export function MessagesTab({ client, initialMessages }: { client: Client; initialMessages: Message[] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(initialMessages)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-anthracite-lighter">Cronologia messaggi inviati al cliente</p>
        <button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm inline-flex items-center gap-1.5">
          <Send size={15} /> Invia nuovo
        </button>
      </div>

      {messages.length === 0 ? (
        <div className="card">
          <EmptyState icon={Mail} title="Nessun messaggio inviato" description="Quando invierai un messaggio al cliente, lo troverai qui." action={{ label: 'Invia messaggio', onClick: () => setOpen(true) }} />
        </div>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-surface text-anthracite-lighter">
                    {m.channel === 'email' ? 'Email' : 'Push'}
                  </span>
                  <span className="text-xs text-anthracite-lighter">{formatDateTime(m.sent_at)}</span>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${m.delivered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {m.delivered ? 'Consegnato' : 'In coda'}
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
