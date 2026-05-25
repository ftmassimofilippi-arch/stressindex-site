import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Supporto | Stress Index',
  description:
    'Hai bisogno di aiuto con Stress Index? Contatta il supporto via email, consulta le guide o leggi le domande frequenti.',
  alternates: { canonical: 'https://stressindex.io/supporto' },
  openGraph: {
    title: 'Supporto | Stress Index',
    description:
      'Hai bisogno di aiuto con Stress Index? Contatta il supporto via email, consulta le guide o leggi le domande frequenti.',
    url: 'https://stressindex.io/supporto',
    siteName: 'Stress Index',
    locale: 'it_IT',
    type: 'website',
    images: [{ url: 'https://stressindex.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Supporto | Stress Index',
    description:
      'Hai bisogno di aiuto con Stress Index? Contatta il supporto via email, consulta le guide o leggi le domande frequenti.',
    images: ['https://stressindex.io/og-image.png'],
  },
}

const SECTIONS = [
  {
    emoji: '📧',
    title: 'Email',
    body: (
      <a
        href="mailto:support@stressindex.io"
        className="text-teal hover:text-teal-dark transition-colors font-medium"
      >
        support@stressindex.io
      </a>
    ),
  },
  {
    emoji: '📖',
    title: 'Guide',
    body: (
      <Link href="/guide" className="text-teal hover:text-teal-dark transition-colors font-medium">
        Consulta le guide
      </Link>
    ),
  },
  {
    emoji: '❓',
    title: 'FAQ',
    body: (
      <Link href="/#faq" className="text-teal hover:text-teal-dark transition-colors font-medium">
        Domande frequenti
      </Link>
    ),
  },
  {
    emoji: '🕐',
    title: 'Orari',
    body: <span className="text-anthracite-light">Lunedì–Venerdì 9:00–18:00 CET</span>,
  },
]

export default function SupportoPage() {
  return (
    <main className="bg-white text-anthracite">
      <Header />

      <section className="pt-16 md:pt-24 pb-16 md:pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-serif text-[36px] md:text-[52px] leading-[1.08] tracking-tight text-anthracite">
            Supporto
          </h1>
          <p className="mt-4 text-[17px] md:text-lg text-anthracite-light leading-relaxed">
            Siamo qui per aiutarti
          </p>

          <div className="mt-12 divide-y divide-gray-100 border-t border-gray-100">
            {SECTIONS.map((s) => (
              <div key={s.title} className="flex items-start gap-4 py-6">
                <span className="text-2xl leading-none" aria-hidden>
                  {s.emoji}
                </span>
                <div>
                  <h2 className="text-base font-semibold text-anthracite">{s.title}</h2>
                  <div className="mt-1 text-[15px]">{s.body}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-12 text-sm text-anthracite-lighter">
            Stress Index è un prodotto di The Performance Lab S.r.l.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  )
}
