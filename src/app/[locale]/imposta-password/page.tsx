import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { SetPasswordForm } from './SetPasswordForm'

type Params = { params: { locale: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('setPassword.title'), robots: { index: false, follow: false } }
}

// Pagina di atterraggio dei link email Supabase (reset password e invito).
// Volutamente FUORI da /area-professionisti: il middleware di quell'area
// rimanda al login chi non ha sessione e rimanda alla dashboard chi ce l'ha,
// e entrambi i comportamenti romperebbero il flusso di recovery.
export default async function ImpostaPasswordPage({ params }: Params) {
  setRequestLocale(params.locale)
  const tCommon = await getTranslations('common')

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-anthracite tracking-tight truncate">{tCommon('brand')}</span>
          </Link>
          <Suspense fallback={null}>
            <LanguageSwitcher className="shrink-0" />
          </Suspense>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <SetPasswordForm />
        </div>
      </main>
    </div>
  )
}
