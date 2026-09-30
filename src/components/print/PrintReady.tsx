'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    __REPORT_READY__?: boolean
  }
}

// Segnala a Chrome headless che la pagina di stampa è completa: font caricati
// (document.fonts.ready) e grafici montati (due frame dopo l'idratazione).
export function PrintReady() {
  useEffect(() => {
    let cancelled = false
    document.documentElement.classList.add('print-mode')
    const fonts = typeof document.fonts?.ready?.then === 'function' ? document.fonts.ready : Promise.resolve()
    fonts.then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) window.__REPORT_READY__ = true
        })
      })
    })
    return () => {
      cancelled = true
    }
  }, [])
  return null
}
