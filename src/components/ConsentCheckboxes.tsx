'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PRO_REQUIRED, type ProConsentType, type ProConsents } from '@/lib/consents'

// Le quattro caselle del pacchetto legale 2.1 per i professionisti, uguali in
// registrazione e nella riaccettazione. Mai pre-spuntate; ognuna col suo link.
const ORDER: ProConsentType[] = ['terms_privacy', 'dpa', 'wellness_ack', 'marketing']
const linkClass = 'text-teal hover:text-teal-dark underline underline-offset-2'

export function ConsentCheckboxes({
  value,
  onChange,
  disabled,
}: {
  value: ProConsents
  onChange: (next: ProConsents) => void
  disabled?: boolean
}) {
  const t = useTranslations('consents')
  return (
    <fieldset className="space-y-3">
      {ORDER.map((k) => {
        const required = (PRO_REQUIRED as readonly string[]).includes(k)
        return (
          <label key={k} className="flex items-start gap-3 text-sm text-anthracite-light leading-relaxed cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-teal"
              checked={value[k]}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, [k]: e.target.checked })}
              aria-required={required}
            />
            <span>
              {t.rich(k, {
                terms: (c) => <Link href="/termini" target="_blank" className={linkClass}>{c}</Link>,
                privacy: (c) => <Link href="/privacy" target="_blank" className={linkClass}>{c}</Link>,
                dpa: (c) => <Link href="/legal/dpa" target="_blank" className={linkClass}>{c}</Link>,
              })}{' '}
              <span className="text-xs text-anthracite-lighter">({t(required ? 'required' : 'optional')})</span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
