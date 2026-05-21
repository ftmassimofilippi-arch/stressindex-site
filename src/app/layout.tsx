import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display, DM_Mono } from 'next/font/google'
import '@/styles/globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-dm-serif',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://stressindex.io'),
  title: {
    default: 'Stress Index | Software HRV Professionale per Fisioterapisti',
    template: '%s',
  },
  description:
    'Misura lo stress del sistema nervoso autonomo in 10 minuti. 5 score clinici, 25+ parametri HRV, report PDF. Per fisioterapisti e professionisti del benessere.',
  keywords: [
    'software HRV',
    'analisi HRV',
    'misurare stress',
    'sistema nervoso autonomo',
    'Heart Rate Variability',
    'variabilità frequenza cardiaca',
    'biofeedback',
    'Polar H10',
    'ECG',
    'fisioterapia',
    'osteopatia',
    'medico sportivo',
    'coaching benessere',
    'DFA Alpha1',
  ],
  authors: [{ name: 'Stress Index' }],
  creator: 'Stress Index',
  publisher: 'The Performance Lab S.r.l.',
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: 'https://stressindex.io',
    siteName: 'Stress Index',
    title: 'Stress Index | Software HRV Professionale per Fisioterapisti',
    description:
      'Misura lo stress del sistema nervoso autonomo in 10 minuti. 5 score clinici, 25+ parametri HRV, report PDF. Per fisioterapisti e professionisti del benessere.',
    images: [{ url: 'https://stressindex.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stress Index | Software HRV Professionale per Fisioterapisti',
    description:
      'Misura lo stress del sistema nervoso autonomo in 10 minuti. 5 score clinici, 25+ parametri HRV, report PDF.',
    images: ['https://stressindex.io/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Stress Index',
  legalName: 'The Performance Lab S.r.l.',
  url: 'https://stressindex.io',
  logo: 'https://stressindex.io/logo.png',
  description:
    'Software HRV professionale per fisioterapisti e professionisti del benessere',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'IT',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@stressindex.io',
    contactType: 'customer support',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it" className={`${dmSans.variable} ${dmSerif.variable} ${dmMono.variable}`}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
      </body>
    </html>
  )
}
