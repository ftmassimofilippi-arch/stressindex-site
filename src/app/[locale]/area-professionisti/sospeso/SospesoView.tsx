import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { PauseCircle } from 'lucide-react'
import { Suspense } from 'react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { SignOutButton } from './SignOutButton'

// Schermata "account sospeso" (migration 024). La rende il layout dell'area
// professionisti al posto di QUALSIASI pagina quando lo stato è "sospeso"
// (prima era un rewrite del middleware, che per saperlo chiamava la RPC a ogni
// richiesta). Nessun dato di clienti o misurazioni: messaggio, contatto, uscita.
export async function SospesoView() {
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
