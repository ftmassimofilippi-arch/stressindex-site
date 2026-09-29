import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { RecoverForm } from './RecoverForm'
import { RecoveryLinkRedirect } from '@/components/RecoveryLinkRedirect'

type Params = { params: { locale: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('recoverPassword.title'), robots: { index: false, follow: false } }
}

export default async function RecuperaPasswordPage({ params }: Params) {
  setRequestLocale(params.locale)
  const t = await getTranslations('auth.recover')
  const tCommon = await getTranslations('common')

  return (
    <>
      {/* Inoltra i token dei link email a /imposta-password */}
      <RecoveryLinkRedirect />
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
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">
            <span aria-hidden="true">🔑</span>
            <span>{t('eyebrow')}</span>
          </div>
          <h1 className="font-serif text-4xl text-anthracite tracking-tight">{t('title')}</h1>
          <p className="mt-3 text-anthracite-light">{t('intro')}</p>

          <div className="mt-8">
            <RecoverForm />
          </div>

          <p className="mt-8 text-sm text-anthracite-lighter text-center">
            <Link href="/area-professionisti/login" className="text-teal-dark font-medium hover:underline">
              {t('backToLogin')}
            </Link>
          </p>
        </div>
      </main>
    </div>
    </>
  )
}
