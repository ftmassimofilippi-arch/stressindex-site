'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, X } from 'lucide-react'
import type { PendingInvite } from '@/lib/dashboard-data'

export function InviteBanner({ invites }: { invites: PendingInvite[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const visible = invites.filter((i) => !dismissed.has(i.id))
  if (visible.length === 0) return null

  async function respond(inviteId: string, action: 'accept' | 'reject') {
    setBusy(inviteId)
    const res = await fetch('/api/organization/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId, action }),
    })
    setBusy(null)
    if (res.ok) {
      setDismissed((d) => new Set([...d, inviteId]))
      router.refresh()
    }
  }

  return (
    <div className="mb-6 space-y-2">
      {visible.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-teal-light/60 border border-teal/30"
        >
          <div className="w-10 h-10 rounded-xl bg-white text-teal-dark flex items-center justify-center flex-shrink-0">
            <Building2 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-anthracite">
              <span className="text-teal-dark">{inv.organization_name ?? 'Un\'organizzazione'}</span>{' '}
              ti ha invitato a unirti al team
            </div>
            <div className="text-xs text-anthracite-lighter mt-0.5">
              Come {inv.role === 'admin' ? 'amministratore' : 'professionista'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => respond(inv.id, 'accept')}
            disabled={busy === inv.id}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal hover:bg-teal-dark text-white text-sm font-medium disabled:opacity-50"
          >
            <Check size={15} /> Accetta
          </button>
          <button
            type="button"
            onClick={() => respond(inv.id, 'reject')}
            disabled={busy === inv.id}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-surface-border bg-white hover:bg-surface text-sm text-anthracite disabled:opacity-50"
          >
            <X size={15} /> Rifiuta
          </button>
        </div>
      ))}
    </div>
  )
}
