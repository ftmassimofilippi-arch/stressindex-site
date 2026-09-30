import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { PauseCircle } from 'lucide-react'
import { SignOutButton } from './SignOutButton'
import { Suspense } from 'react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

type Params = { params: { locale: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('suspended.title'), robots: { index: false, follow: false } }
}

export const dynamic = 'force-dynamic'

// Mostrata dal middleware (rewrite) a ogni pagina dell'area professionisti
// quando lo stato dell'account è "sospeso" (migration 024). Nessun dato di
// clienti o misurazioni: solo il messaggio, il contatto e l'uscita.
export default async function AccountSospesoPage() {
  const t = await getTranslations('auth.suspended')

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-16 relative">
      <div className="absolute top-4 right-4">
        <Suspense fallback={null}>
          <LanguageSwitcher />
        </Suspense>
      </div>
      <div className="w-full max-w-md bg-white border border-surface-border rounded-2xl p-8 text-center shadow-card">
        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5">
          <PauseCircle size={24} />
        </div>
        <h1 className="font-serif text-3xl text-anthracite">{t('title')}</h1>
        <p className="mt-3 text-sm text-anthracite-light">{t('body')}</p>
        <p className="mt-4 text-sm text-anthracite-light">
          {t.rich('contact', {
            link: (chunks) => (
              <a href="mailto:support@stressindex.io" className="text-teal-dark font-medium hover:underline">
                {chunks}
              </a>
            ),
          })}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/supporto" className="btn-secondary text-sm">{t('supportPage')}</Link>
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
