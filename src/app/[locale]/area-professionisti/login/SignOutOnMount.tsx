'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

// Account bloccato: il layout dell'area manda qui con `?stato=bloccato` e la
// sessione va chiusa lato client (un server component non può scrivere i
// cookie). Il ban in auth rifiuta comunque i refresh successivi.
export function SignOutOnMount() {
  useEffect(() => {
    createClient().auth.signOut().catch(() => {})
  }, [])
  return null
}
