'use client'

import { useEffect } from 'react'

// I link email di Supabase possono atterrare su /area-professionisti/login o
// /area-professionisti/recupera-password (email già inviate, oppure Site URL
// configurata su quelle pagine): nessuna delle due sa gestire il token, quindi
// l'utente vedeva un form inutile. Qui il token viene inoltrato — fragment
// incluso — a /imposta-password, che lo gestisce davvero.
//
// Deve girare PRIMA che un client Supabase venga creato su queste pagine
// (detectSessionInUrl consumerebbe il fragment): su login e recupera-password
// il client nasce solo al submit, quindi il fragment è ancora intatto.
export function RecoveryLinkRedirect() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    const type = hash.get('type') ?? query.get('type')
    const isAuthType = type === 'recovery' || type === 'invite' || type === 'signup'
    const hasToken = !!(hash.get('access_token') || query.get('token_hash') || (isAuthType && query.get('code')))
    const hasError = !!(hash.get('error_code') || hash.get('error'))
    if (!hasToken && !hasError) return
    window.location.replace(`/imposta-password${window.location.search}${window.location.hash}`)
  }, [])

  return null
}
