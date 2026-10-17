import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { ShieldCheck } from 'lucide-react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { COMPANY } from '@/config/company'
import { ConsentGateForm } from './ConsentGateForm'

// Riaccettazione dei documenti 2.1 (pacchetto legale, Doc 6). La rende il
// layout dell'area professionisti al posto di qualsiasi pagina finché mancano i
// consensi obbligatori: non si chiude, non mostra dati di clienti.
export async function ConsentGateView() {
  const t = await getTranslations('consents.gate')
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-16 relative">
      <div className="absolute top-4 right-4">
        <Suspense fallback={null}>
          <LanguageSwitcher />
        </Suspense>
      </div>
      <div className="w-full max-w-xl bg-white border border-surface-border rounded-2xl p-8 shadow-card">
        <div className="w-12 h-12 rounded-xl bg-teal-light text-teal-dark flex items-center justify-center mb-5">
          <ShieldCheck size={24} />
        </div>
        <h1 className="font-serif text-3xl text-anthracite">{t('title')}</h1>
        <p className="mt-3 text-sm text-anthracite-light leading-relaxed">{t('body')}</p>
        <div className="mt-6">
          <ConsentGateForm privacyEmail={COMPANY.privacyEmail} />
        </div>
      </div>
    </div>
  )
}
