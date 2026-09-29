import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { LoginForm } from './LoginForm'
import { Link } from '@/i18n/navigation'
import { splitLocale } from '@/i18n/routing'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { RecoveryLinkRedirect } from '@/components/RecoveryLinkRedirect'

type Props = { params: { locale: string }; searchParams: { redirect?: string; stato?: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('login.title'), robots: { index: false, follow: false } }
}

// Il parametro `redirect` arriva dal middleware già SENZA prefisso di lingua
// (lo rimette il router i18n al push). Se qualcuno lo passa a mano con il
// prefisso, lo si toglie; e si accettano solo percorsi interni.
function safeRedirect(raw: string | undefined): string {
  const fallback = '/area-professionisti'
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback
  return splitLocale(raw).path
}

export default async function LoginPage({ searchParams }: Props) {
  const t = await getTranslations('auth.login')
  const tCommon = await getTranslations('common')
  const redirectTo = safeRedirect(searchParams.redirect)

  return (
    <>
      {/* Inoltra i token dei link email a /imposta-password */}
      <RecoveryLinkRedirect />
      <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar minimale */}
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
            <span aria-hidden="true">🔐</span>
            <span>{tCommon('proArea')}</span>
          </div>
          <h1 className="font-serif text-4xl text-anthracite tracking-tight">{t('title')}</h1>
          <p className="mt-3 text-anthracite-light">{t('intro')}</p>

          {searchParams.stato === 'bloccato' && (
            <div className="mt-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700" role="alert">
              {t.rich('blocked', {
                link: (chunks) => (
                  <a href="mailto:support@stressindex.io" className="font-medium underline">
                    {chunks}
                  </a>
                ),
              })}
            </div>
          )}

          <div className="mt-8">
            <LoginForm redirectTo={redirectTo} />
          </div>

          <p className="mt-8 text-sm text-anthracite-lighter text-center">
            {t.rich('noAccount', {
              link: (chunks) => (
                <Link href="/registrazione" className="text-teal-dark font-medium hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </main>
    </div>
    </>
  )
}
