'use client'

import { useEffect } from 'react'
import NextError from 'next/error'
import * as Sentry from '@sentry/nextjs'

// Ultima rete: errori nel layout radice, dove `[locale]/error.tsx` non arriva.
// Qui non c'è il provider delle traduzioni, quindi si mostra la pagina di
// errore generica di Next invece di un testo scritto a mano in una lingua sola.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
