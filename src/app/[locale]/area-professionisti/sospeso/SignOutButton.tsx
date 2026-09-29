'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

export function SignOutButton() {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await createClient().auth.signOut()
        window.location.href = '/area-professionisti/login'
      }}
      className="text-sm px-4 py-2.5 rounded-xl border border-surface-border hover:bg-surface inline-flex items-center gap-1.5 disabled:opacity-50"
    >
      <LogOut size={14} /> Esci
    </button>
  )
}
