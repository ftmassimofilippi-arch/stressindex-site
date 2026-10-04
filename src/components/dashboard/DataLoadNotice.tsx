import { getTranslations } from 'next-intl/server'

// Mostrato al posto di una sezione i cui dati non si sono caricati (vedi
// `src/lib/data-error.ts`): dice che c'è stato un errore, non che i dati non
// esistono. L'errore è già stato registrato da chi ha fatto la lettura.
export async function DataLoadNotice({ className = '' }: { className?: string }) {
  const t = await getTranslations('errors.dataLoad')
  return (
    <div role="alert" className={`card p-6 border border-amber-200 bg-amber-50 ${className}`}>
      <p className="text-sm font-medium text-anthracite">{t('title')}</p>
      <p className="text-sm text-anthracite-light mt-1 leading-relaxed">{t('body')}</p>
    </div>
  )
}
