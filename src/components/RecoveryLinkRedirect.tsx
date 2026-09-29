'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { withLocale, type Locale } from '@/i18n/routing'

// I link email di Supabase possono atterrare su /area-professionisti/login,
// /area-professionisti/recupera-password o sulla home (quando il redirectTo non
// è in allowlist Supabase ripiega sulla Site URL): nessuna di queste pagine sa
// gestire il token, quindi l'utente vedeva un form inutile o la landing. Qui il
// token viene inoltrato, fragment incluso, a /imposta-password (nella lingua
// corrente), che lo gestisce davvero.
//
// Deve girare PRIMA che un client Supabase venga creato su queste pagine
// (detectSessionInUrl consumerebbe il token): su login, recupera-password e
// home il client nasce solo al submit o non nasce affatto, quindi l'URL è
// ancora intatto.
export function RecoveryLinkRedirect() {
  const locale = useLocale() as Locale

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    // Il codice PKCE arriva spesso da solo, senza `type`: Supabase lo aggiunge
    // solo se è nel template email. `code` non è usato per altro sul sito,
    // quindi la sua sola presenza basta a riconoscere un link di auth.
    const hasToken = !!(
      hash.get('access_token') ||
      query.get('code') ||
      query.get('token_hash') ||
      query.get('token')
    )
    const hasError = !!(hash.get('error_code') || hash.get('error') || query.get('error_code') || query.get('error'))
    if (!hasToken && !hasError) return
    window.location.replace(`${withLocale('/imposta-password', locale)}${window.location.search}${window.location.hash}`)
  }, [locale])

  return null
}
