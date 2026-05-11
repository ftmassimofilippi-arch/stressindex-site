import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Stress Index | Software HRV Professionale per Fisioterapisti e Osteopati',
    template: '%s | Stress Index',
  },
  description:
    'Misura lo stress dei tuoi clienti in 10 minuti. Software HRV professionale per fisioterapisti, osteopati e medici sportivi. 4 indici clinici, report PDF, 15 giorni gratis.',
  keywords: [
    'HRV',
    'Heart Rate Variability',
    'variabilità frequenza cardiaca',
    'analisi stress',
    'biofeedback',
    'sistema nervoso autonomo',
    'Polar H10',
    'ECG',
    'fisioterapia',
    'osteopatia',
    'coaching',
    'benessere professionale',
  ],
  authors: [{ name: 'Stress Index' }],
  creator: 'Stress Index',
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: 'https://stressindex.io',
    siteName: 'Stress Index',
    title: 'Stress Index | Software HRV Professionale per Fisioterapisti e Osteopati',
    description:
      'Misura lo stress dei tuoi clienti in 10 minuti. Software HRV professionale per fisioterapisti, osteopati e medici sportivi. 4 indici clinici, report PDF, 15 giorni gratis.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stress Index | Software HRV Professionale per Fisioterapisti e Osteopati',
    description:
      'Misura lo stress dei tuoi clienti in 10 minuti. 4 indici clinici, report PDF, 15 giorni gratis.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
