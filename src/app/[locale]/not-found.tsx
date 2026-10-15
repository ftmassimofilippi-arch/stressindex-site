import type { Metadata } from 'next'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

// Next 14.2 legge `generateMetadata` anche da not-found.tsx (è l'ultimo
// elemento della catena dei metadata quando si renderizza il 404, vedi
// `errorMetadataItem` in next/dist/lib/metadata/resolve-metadata.js): così la
// pagina non eredita il titolo e `index: true` della home. Il layout radice ha
// `template: '%s'`, quindi il suffisso "| Stress Index" sta nel messaggio.
export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return { title: t('notFound.title'), robots: { index: false, follow: false } }
}

export default function NotFound() {
  const t = useTranslations('errors.notFound')
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white pt-16">
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">
          <div className="text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">404</div>
          <h1 className="font-serif text-4xl sm:text-5xl text-anthracite tracking-tight mb-4">{t('title')}</h1>
          <p className="text-lg text-anthracite-light leading-relaxed mb-10 max-w-md mx-auto">{t('body')}</p>
          <Link href="/" className="btn-primary inline-flex">
            {t('cta')}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
