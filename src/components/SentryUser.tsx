'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase-browser'

// Lega gli errori del browser all'utente collegato: SOLO l'uuid, mai l'email
// (vedi `src/lib/sentry-options.ts`). Al logout l'utente viene tolto.
export function SentryUser() {
  useEffect(() => {
    const supabase = createClient()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      Sentry.setUser(session?.user ? { id: session.user.id } : null)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return null
}
