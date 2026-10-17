'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ConsentCheckboxes } from '@/components/ConsentCheckboxes'
import { EMPTY_PRO_CONSENTS, hasAllRequired, type ProConsents } from '@/lib/consents'
import { SignOutButton } from '../sospeso/SignOutButton'

export function ConsentGateForm({ privacyEmail }: { privacyEmail: string }) {
  const t = useTranslations('consents.gate')
  const locale = useLocale()
  const [consents, setConsents] = useState<ProConsents>(EMPTY_PRO_CONSENTS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [declined, setDeclined] = useState(false)

  if (declined) {
    return (
      <div className="text-center">
        <h2 className="font-serif text-2xl text-anthracite">{t('declinedTitle')}</h2>
        <p className="mt-3 text-sm text-anthracite-light">{t('declinedBody', { privacyEmail })}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-secondary text-sm" onClick={() => setDeclined(false)}>{t('back')}</button>
          <SignOutButton />
        </div>
      </div>
    )
  }

  async function accept() {
    setBusy(true)
    setError(false)
    try {
      const res = await fetch('/api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consents, lang: locale }),
      })
      if (!res.ok) throw new Error(String(res.status))
      // ricarica completa: il layout rilegge lo stato dei consensi dal server
      window.location.reload()
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <div>
      <ConsentCheckboxes value={consents} onChange={setConsents} disabled={busy} />
      {error && <p className="mt-4 text-sm text-red-600" role="alert">{t('error')}</p>}
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={busy || !hasAllRequired(consents)} onClick={accept}>
          {busy ? t('saving') : t('accept')}
        </button>
        <button type="button" className="text-sm text-anthracite-lighter hover:text-anthracite underline underline-offset-2" disabled={busy} onClick={() => setDeclined(true)}>
          {t('decline')}
        </button>
      </div>
    </div>
  )
}
