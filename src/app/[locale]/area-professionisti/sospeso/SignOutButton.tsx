'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { LogOut } from 'lucide-react'
import { withLocale, type Locale } from '@/i18n/routing'
import { createClient } from '@/lib/supabase-browser'

export function SignOutButton() {
  const t = useTranslations('common')
  const locale = useLocale() as Locale
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await createClient().auth.signOut()
        // Navigazione completa (non router.push): il middleware deve rileggere
        // i cookie di sessione da zero. Il prefisso di lingua resta.
        window.location.assign(withLocale('/area-professionisti/login', locale))
      }}
      className="text-sm px-4 py-2.5 rounded-xl border border-surface-border hover:bg-surface inline-flex items-center gap-1.5 disabled:opacity-50"
    >
      <LogOut size={14} /> {t('logout')}
    </button>
  )
}
