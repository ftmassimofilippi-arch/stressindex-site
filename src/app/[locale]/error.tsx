'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors.unexpected')

  useEffect(() => {
    console.error(error)
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl text-anthracite tracking-tight mb-3">{t('title')}</h1>
        <p className="text-anthracite-light leading-relaxed mb-8">{t('body')}</p>
        <button type="button" onClick={reset} className="btn-primary">
          {t('retry')}
        </button>
      </div>
    </main>
  )
}
