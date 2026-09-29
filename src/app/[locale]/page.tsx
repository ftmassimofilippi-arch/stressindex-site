import type { Metadata } from 'next'
import { Suspense } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'
import { formatEur } from '@/lib/format'
import { HomeNavbar } from './HomeNavbar'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { RecoveryLinkRedirect } from '@/components/RecoveryLinkRedirect'

// Prezzi mostrati nella landing (EUR al mese).
const PRICE_FOUNDING = 49.9
const PRICE_STANDARD = 69.9

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return pageMetadata({
    locale: params.locale as Locale,
    path: '/',
    title: t('home.title'),
    description: t('home.description'),
    shortDescription: t('home.shortDescription'),
  })
}

type FaqItem = { q: string; a: string }
type TitledItem = { title: string; body: string }

/** Legge le FAQ dai messaggi e sostituisce i segnaposto dei prezzi (t.raw non interpola). */
function useFaqItems(): FaqItem[] {
  const t = useTranslations('home')
  const locale = useLocale()
  const price = formatEur(PRICE_FOUNDING, locale)
  const standard = formatEur(PRICE_STANDARD, locale)
  const items = t.raw('faq.items') as FaqItem[]
  return items.map((it) => ({
    q: it.q,
    a: it.a.replaceAll('{price}', price).replaceAll('{standard}', standard),
  }))
}

function Logo({ light = false }: { light?: boolean }) {
  const t = useTranslations('common')
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 group" aria-label={t('logoAria')}>
      <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className={`text-lg font-semibold tracking-tight ${light ? 'text-white' : 'text-anthracite'}`}>
        {t('brand')}
      </span>
    </Link>
  )
}

function HeroMockup() {
  const t = useTranslations('home.mockup')
  const ts = useTranslations('scores.names')
  const scores = [
    { label: ts('stress'), value: 72, barClass: 'bg-[#E85D4A]' },
    { label: ts('recovery'), value: 68, barClass: 'bg-teal' },
    { label: ts('balance'), value: 55, barClass: 'bg-[#F59E0B]' },
    { label: ts('energy'), value: 63, barClass: 'bg-[#6366F1]' },
  ]
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="rounded-2xl bg-white border border-gray-200 p-4">
        <div className="rounded-xl bg-surface overflow-hidden border border-gray-100">
          <div className="bg-teal text-white px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-white/80 flex-shrink-0" />
              <span className="text-[13px] font-medium tracking-tight truncate">{t('measuring')}</span>
            </div>
            <span className="text-[12px] font-mono opacity-80">08:32</span>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            {scores.map((s) => (
              <div key={s.label} className="bg-white rounded-lg p-3.5 border border-gray-200">
                <div className="text-[11px] uppercase tracking-wider text-anthracite-lighter font-medium truncate">{s.label}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-anthracite tabular-nums">{s.value}</span>
                  <span className="text-xs text-anthracite-lighter">/100</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${s.barClass}`} style={{ width: `${s.value}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mx-4 mb-4 rounded-lg bg-white border border-gray-200 px-3.5 py-3 flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-[12px] font-medium text-anthracite">Polar H10</span>
            <span className="text-[12px] text-anthracite-lighter">·</span>
            <span className="text-[12px] text-anthracite-lighter tabular-nums">{t('ecgLive')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  const t = useTranslations('home.hero')
  const tc = useTranslations('common')
  return (
    <section className="pt-32 md:pt-36 pb-16 md:pb-20 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-teal-dark">
            <span aria-hidden="true">🩺</span>
            <span>{t('eyebrow')}</span>
          </div>
          <h1 className="mt-4 font-serif text-[36px] md:text-[52px] leading-[1.08] tracking-tight text-anthracite">
            {t('titleLead')}{' '}
            <em className="italic text-teal">{t('titleEm')}</em>
          </h1>
          <p className="mt-5 text-[17px] md:text-lg text-anthracite-light leading-relaxed max-w-xl">
            {t('body')}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link
              href="/registrazione"
              className="inline-flex items-center justify-center px-6 py-3 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark transition-colors"
            >
              {tc('trial60')}
              <span className="ml-2" aria-hidden="true">→</span>
            </Link>
            <a
              href="#come-funziona"
              className="inline-flex items-center px-2 py-3 text-anthracite font-medium hover:text-teal transition-colors"
            >
              {t('ctaHow')}
              <span className="ml-1" aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="mt-4 text-sm text-anthracite-lighter">
            {tc('trialNote')}
          </p>
        </div>

        <div className="md:pl-4">
          <HeroMockup />
        </div>
      </div>
    </section>
  )
}

function TrustBar() {
  const t = useTranslations('home.trust')
  const items = [
    { icon: '🔬', text: t('params') },
    { icon: '📱', text: t('platforms') },
    { icon: '🇪🇺', text: t('eu') },
    { icon: '📄', text: t('pdf') },
    { icon: '🩺', text: t('pros') },
  ]
  return (
    <section className="border-y border-gray-100 py-5 px-6">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[14px] text-anthracite-light">
        {items.map((it) => (
          <div key={it.text} className="flex items-center gap-2">
            <span aria-hidden="true">{it.icon}</span>
            <span>{it.text}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Problem() {
  const t = useTranslations('home.problem')
  const icons = ['🎯', '⏳', '🔁']
  const cards = t.raw('cards') as TitledItem[]
  return (
    <section className="py-16 md:py-24 px-6 border-b border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">⚡</span>
            <span>{t('eyebrow')}</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            {t('titleLead')} <em className="italic text-teal">{t('titleEm')}</em>
          </h2>
          <p className="mt-5 text-[17px] text-anthracite-light leading-relaxed">
            {t('body')}
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {cards.map((c, i) => (
            <div
              key={c.title}
              className="rounded-xl border border-gray-200 bg-white p-6"
            >
              <div className="text-2xl" aria-hidden="true">{icons[i]}</div>
              <h3 className="mt-3 text-lg font-semibold text-anthracite tracking-tight">{c.title}</h3>
              <p className="mt-2 text-[15px] text-anthracite-light leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ScoreCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-white rounded-lg p-5 border border-gray-200">
      <div className="text-[11px] uppercase tracking-wider text-anthracite-lighter font-medium truncate">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-4xl font-semibold text-anthracite tabular-nums">{value}</span>
        <span className="text-sm text-anthracite-lighter">/100</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function Solution() {
  const t = useTranslations('home.solution')
  const ts = useTranslations('scores.names')
  const features = t.raw('features') as TitledItem[]
  return (
    <section className="py-16 md:py-24 px-6 border-b border-gray-100">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 md:gap-20 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">📊</span>
            <span>{t('eyebrow')}</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            {t('titleLead')} <em className="italic text-teal">{t('titleEm')}</em>
          </h2>
          <p className="mt-5 text-[17px] text-anthracite-light leading-relaxed">
            {t('body')}
          </p>
          <ul className="mt-8 space-y-5">
            {features.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="flex-shrink-0 text-teal mt-0.5 font-semibold" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <div className="font-semibold text-anthracite">{f.title}</div>
                  <p className="mt-1 text-[15px] text-anthracite-light leading-relaxed">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="rounded-2xl bg-white border border-gray-200 p-6 md:p-7">
            <div className="grid grid-cols-2 gap-4">
              <ScoreCard label={ts('stress')} value={72} color="#E85D4A" />
              <ScoreCard label={ts('recovery')} value={68} color="#4FA39A" />
              <ScoreCard label={ts('balance')} value={55} color="#F59E0B" />
              <ScoreCard label={ts('energy')} value={63} color="#6366F1" />
            </div>
            <div className="mt-5 rounded-lg border-l-4 border-teal bg-teal-light/50 px-4 py-3.5">
              <div className="text-[11px] uppercase tracking-wider text-teal-dark font-semibold">
                💡 {t('adaptation.label')}
              </div>
              <div className="mt-1 text-[14px] text-anthracite leading-relaxed">
                <span className="font-semibold">{t('adaptation.value')}</span> · {t('adaptation.text')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const t = useTranslations('home.how')
  const icons = ['🩺', '⏱️', '📋']
  const steps = t.raw('steps') as TitledItem[]
  return (
    <section id="come-funziona" className="py-16 md:py-24 px-6 scroll-mt-20 border-b border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">🎯</span>
            <span>{t('eyebrow')}</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            {t('titleLead')} <em className="italic text-teal">{t('titleEm')}</em>
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative bg-white rounded-xl p-6 border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl" aria-hidden="true">{icons[i]}</span>
                <span className="font-mono text-[13px] text-anthracite-lighter tabular-nums" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-anthracite tracking-tight">{s.title}</h3>
              <p className="mt-2 text-[15px] text-anthracite-light leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Benefits() {
  const t = useTranslations('home.benefits')
  const icons = ['📱', '👥', '🇪🇺', '🔬']
  const items = t.raw('items') as TitledItem[]
  return (
    <section id="benefici" className="py-16 md:py-24 px-6 scroll-mt-20 border-b border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">💡</span>
            <span>{t('eyebrow')}</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            {t('titleLead')} <em className="italic text-teal">{t('titleEm')}</em>
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-5">
          {items.map((b, i) => (
            <div
              key={b.title}
              className="bg-white rounded-xl p-6 border border-gray-200"
            >
              <div className="text-2xl" aria-hidden="true">
                {icons[i]}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-anthracite tracking-tight">{b.title}</h3>
              <p className="mt-2 text-[15px] text-anthracite-light leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ExplorePages() {
  const t = useTranslations('home.explore')
  const tc = useTranslations('common')
  return (
    <section className="py-16 md:py-24 px-6 border-b border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">🧭</span>
            <span>{t('eyebrow')}</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            {t('titleLead')} <em className="italic text-teal">{t('titleEm')}</em>
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-5">
          <Link
            href="/funzionalita"
            className="group rounded-xl border border-gray-200 bg-white p-6 md:p-7 transition-all hover:shadow-md hover:border-gray-300"
          >
            <div className="text-3xl" aria-hidden="true">🔬</div>
            <h3 className="mt-4 text-xl font-semibold text-anthracite tracking-tight">
              {t('features.title')}
            </h3>
            <p className="mt-3 text-[15px] text-anthracite-light leading-relaxed">
              {t('features.body')}
            </p>
            <span className="mt-5 inline-flex items-center text-teal-dark font-medium group-hover:text-teal transition-colors">
              {t('features.cta')}
              <span className="ml-1.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                →
              </span>
            </span>
          </Link>

          <Link
            href="/sport"
            className="group rounded-xl border border-gray-200 bg-white p-6 md:p-7 transition-all hover:shadow-md hover:border-gray-300 relative"
          >
            <div className="absolute top-5 right-5 inline-flex items-center px-2 py-0.5 rounded-full bg-teal text-white text-[10px] font-semibold uppercase tracking-wider">
              {tc('new')}
            </div>
            <div className="text-3xl" aria-hidden="true">🏋️</div>
            <h3 className="mt-4 text-xl font-semibold text-anthracite tracking-tight pr-16">
              {t('sport.title')}
            </h3>
            <p className="mt-3 text-[15px] text-anthracite-light leading-relaxed">
              {t('sport.body')}
            </p>
            <span className="mt-5 inline-flex items-center text-teal-dark font-medium group-hover:text-teal transition-colors">
              {t('sport.cta')}
              <span className="ml-1.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                →
              </span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  const t = useTranslations('home.pricing')
  const locale = useLocale()
  const price = formatEur(PRICE_FOUNDING, locale)
  const standard = formatEur(PRICE_STANDARD, locale)
  const features = t.raw('features') as string[]
  return (
    <section id="prezzi" className="py-16 md:py-24 px-6 scroll-mt-20 border-b border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">💰</span>
            <span>{t('eyebrow')}</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            {t('titleLead')} <em className="italic text-teal">{t('titleEm')}</em>
          </h2>
          <p className="mt-5 text-[17px] text-anthracite-light leading-relaxed">
            {t('body')}
          </p>
        </div>

        <div className="mt-12 mx-auto max-w-[640px] bg-white rounded-xl border border-gray-200 p-8 md:p-10">
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-light text-teal-dark text-[13px] font-medium text-center">
              <span aria-hidden="true">⭐</span> {t('badge')}
            </span>
          </div>

          <div className="mt-6 text-center">
            <h3 className="font-serif text-2xl md:text-3xl text-anthracite tracking-tight">{t('planName')}</h3>
            <p className="mt-2 text-anthracite-light text-[15px]">
              {t('planFor')}
            </p>
          </div>

          <div className="mt-6 text-center">
            <div className="font-serif text-5xl text-anthracite tracking-tight">
              {price}
              <span className="text-xl text-anthracite-light font-sans font-normal"> {t('perMonth')}</span>
            </div>
            <p className="mt-3 text-sm text-anthracite-lighter">
              {t.rich('standardNote', { s: (chunks) => <s>{chunks}</s>, standard, price })}
            </p>
          </div>

          <div className="mt-6 rounded-lg border-l-4 border-teal bg-teal-light/50 px-4 py-3 flex items-start gap-3">
            <span aria-hidden="true" className="text-lg leading-none mt-0.5">🎯</span>
            <p className="text-[14px] text-anthracite leading-relaxed">
              {t.rich('lockNote', { b: (chunks) => <strong>{chunks}</strong>, price })}
            </p>
          </div>

          <ul className="mt-7 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[15px] text-anthracite">
                <span className="flex-shrink-0 text-teal font-semibold mt-0.5" aria-hidden="true">
                  ✓
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/registrazione"
            className="mt-8 w-full inline-flex items-center justify-center px-6 py-3 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark transition-colors"
          >
            {t('cta')}
            <span className="ml-2" aria-hidden="true">→</span>
          </Link>

          <p className="mt-4 text-center text-sm text-anthracite-lighter">
            {t('note', { price })}
          </p>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  const t = useTranslations('home.faq')
  const items = useFaqItems()
  return (
    <section id="faq" className="py-16 md:py-24 px-6 scroll-mt-20 border-b border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">❓</span>
            <span>{t('eyebrow')}</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            {t('titleLead')} <em className="italic text-teal">{t('titleEm')}</em>
          </h2>
        </div>

        <div className="mt-10 max-w-[760px] space-y-2">
          {items.map((it, i) => (
            <details
              key={i}
              className="group border-b border-gray-100"
            >
              <summary className="cursor-pointer list-none px-2 py-5 flex items-center justify-between gap-4 font-medium text-anthracite hover:text-teal transition-colors focus:outline-none">
                <span className="text-[16px]">{it.q}</span>
                <span
                  className="flex-shrink-0 text-anthracite-lighter transition-transform group-open:rotate-90"
                  aria-hidden="true"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
              </summary>
              <div className="px-2 pb-5 -mt-1 text-[15px] text-anthracite-light leading-relaxed">
                {it.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  const t = useTranslations('home.finalCta')
  const tc = useTranslations('common')
  const locale = useLocale()
  return (
    <section className="py-16 md:py-24 px-6 border-b border-gray-100">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl bg-teal-light/50 border border-teal-mid/40 p-8 md:p-12 text-center">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-teal-dark uppercase tracking-wider">
            <span aria-hidden="true">🚀</span>
            <span>{t('eyebrow')}</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            {t('titleLead')} <em className="italic text-teal">{t('titleEm')}</em>
          </h2>
          <p className="mt-4 text-[17px] text-anthracite-light leading-relaxed">
            {t('body')}
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/registrazione"
              className="inline-flex items-center justify-center px-6 py-3 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark transition-colors"
            >
              {tc('trial60')}
              <span className="ml-2" aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="mt-4 text-sm text-anthracite-lighter">
            {t('note', { price: formatEur(PRICE_FOUNDING, locale) })}
          </p>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const t = useTranslations('home.footer')
  const tc = useTranslations('common')
  const currentYear = new Date().getFullYear()
  const linkClass = 'text-anthracite-light hover:text-teal transition-colors'
  return (
    <footer className="bg-white px-6 pt-16 pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-10 md:gap-12">
          <div>
            <Logo />
            <p className="mt-4 text-[14px] text-anthracite-light leading-relaxed max-w-sm">
              {t('tagline')}
            </p>
          </div>

          <div>
            <h3 className="text-[12px] uppercase tracking-wider text-anthracite-lighter font-semibold">{t('product')}</h3>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><a className={linkClass} href="#come-funziona">{tc('nav.howItWorks')}</a></li>
              <li><a className={linkClass} href="#benefici">{tc('nav.features')}</a></li>
              <li><a className={linkClass} href="#prezzi">{tc('nav.pricing')}</a></li>
              <li><Link className={linkClass} href="/registrazione">{tc('startFree')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-[12px] uppercase tracking-wider text-anthracite-lighter font-semibold">{t('support')}</h3>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><Link className={linkClass} href="/guide">{tc('nav.guidesAndSupport')}</Link></li>
              <li><a className={linkClass} href="#faq">{tc('nav.faq')}</a></li>
              <li><a className={linkClass} href="mailto:support@stressindex.io">{tc('nav.contactUs')}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-[12px] uppercase tracking-wider text-anthracite-lighter font-semibold">{t('legal')}</h3>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><Link className={linkClass} href="/privacy">{tc('nav.privacyPolicy')}</Link></li>
              <li><Link className={linkClass} href="/termini">{tc('nav.termsOfService')}</Link></li>
              <li><Link className={linkClass} href="/cookie">{tc('nav.cookie')}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col md:flex-row md:items-end md:justify-between gap-6 text-[13px] text-anthracite-lighter">
          <div className="leading-relaxed">
            <div className="font-medium text-anthracite-light">Minimax Srl</div>
            <div>Via Francesco Baracca, 88 · 36100 Vicenza (VI) · Italy</div>
            <div>{t('vat', { vat: '04496840242' })}</div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 md:justify-end">
            <span>© {currentYear} Minimax Srl · {tc('allRightsReserved')}</span>
            <Link className="hover:text-teal transition-colors" href="/privacy">{tc('nav.privacyPolicy')}</Link>
            <Link className="hover:text-teal transition-colors" href="/termini">{tc('nav.terms')}</Link>
            <Suspense fallback={null}>
              <LanguageSwitcher />
            </Suspense>
          </div>
        </div>
      </div>
    </footer>
  )
}

/** Dati strutturati (SoftwareApplication + FAQPage) con i testi nella lingua della pagina. */
function JsonLd() {
  const t = useTranslations('home')
  const faq = useFaqItems()
  const softwareApplicationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Stress Index',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Android, iOS',
    description: t('jsonLd.appDescription'),
  }
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  }
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  )
}

export default function Home({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale)
  return (
    <main className="bg-white text-anthracite">
      <JsonLd />
      {/* La home è la Site URL del progetto Supabase: i link email che non
          passano l'allowlist dei redirect atterrano qui. Montato prima di
          tutto il resto, e comunque nessun componente della home crea un
          client Supabase, quindi il token nell'URL è ancora intatto. */}
      <RecoveryLinkRedirect />
      <HomeNavbar />
      <Hero />
      <TrustBar />
      <Problem />
      <Solution />
      <HowItWorks />
      <Benefits />
      <ExplorePages />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  )
}
