import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display, DM_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing, type Locale } from '@/i18n/routing'
import { SITE_URL, alternatesFor, OG_IMAGE } from '@/lib/seo'
import { ogLocale } from '@/i18n/routing'
import { SentryUser } from '@/components/SentryUser'
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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale = (hasLocale(routing.locales, params.locale) ? params.locale : routing.defaultLocale) as Locale
  const t = await getTranslations({ locale, namespace: 'meta' })
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t('home.title'),
      template: '%s',
    },
    description: t('home.description'),
    keywords: t('keywords').split(',').map((k) => k.trim()),
    authors: [{ name: 'Stress Index' }],
    creator: 'Stress Index',
    publisher: 'The Performance Lab S.r.l.',
    alternates: alternatesFor('/', locale),
    openGraph: {
      type: 'website',
      locale: ogLocale[locale],
      url: SITE_URL,
      siteName: 'Stress Index',
      title: t('home.title'),
      description: t('home.description'),
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('home.title'),
      description: t('home.shortDescription'),
      images: [OG_IMAGE.url],
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const { locale } = params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'meta' })
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Stress Index',
    legalName: 'The Performance Lab S.r.l.',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: t('organizationDescription'),
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

  return (
    <html lang={locale} className={`${dmSans.variable} ${dmSerif.variable} ${dmMono.variable}`}>
      <body className="font-sans antialiased">
        <SentryUser />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
