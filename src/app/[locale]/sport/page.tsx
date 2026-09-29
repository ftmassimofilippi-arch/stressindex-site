import type { Metadata } from 'next'
import { useLocale, useTranslations } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'
import { formatEur, num } from '@/lib/format'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return pageMetadata({
    locale: params.locale as Locale,
    path: '/sport',
    title: t('sport.title'),
    description: t('sport.description'),
    shortDescription: t('sport.shortDescription'),
  })
}

// Prezzi in EUR al mese (Pro) e al mese (Base); i concorrenti sono indicativi.
const PRICE_PRO = 69
const PRICE_BASE = 49.9
const PRICE_KUBIOS_YEAR = 750
const PRICE_HRV4_MONTH = 10

// Parte visiva delle 4 zone DFA Alpha1 della landing: titoli e testi in sportLanding.dfa.zones (stesso ordine).
const ZONE_VISUALS = [
  { emoji: '🟢', range: '> 0.75', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { emoji: '🟡', range: '0.50 - 0.75', bg: 'bg-amber-50', text: 'text-amber-700' },
  { emoji: '🟠', range: '0.30 - 0.50', bg: 'bg-orange-50', text: 'text-orange-700' },
  { emoji: '🔴', range: '< 0.30', bg: 'bg-rose-50', text: 'text-rose-700' },
]
const LIVE_ICONS = ['❤️', '📉', '🎯', '🏷️', '⚡']
const POST_ICONS = ['💪', '🔋', '😊', '🩹', '📝']
const BAND_COLORS = ['bg-emerald-500', 'bg-amber-500', 'bg-rose-500']

type TitledItem = { title: string; body: string }

function SectionHeader({
  eyebrow,
  emoji,
  title,
  description,
}: {
  eyebrow: string
  emoji: string
  title: React.ReactNode
  description?: string
}) {
  return (
    <div className="max-w-3xl">
      <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
        <span aria-hidden="true">{emoji}</span>
        <span>{eyebrow}</span>
      </div>
      <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-[17px] text-anthracite-light leading-relaxed">{description}</p>
      ) : null}
    </div>
  )
}

function Title({ lead, em, emClass = 'text-teal' }: { lead: string; em: string; emClass?: string }) {
  return (
    <>
      {lead} <em className={`italic ${emClass}`}>{em}</em>
    </>
  )
}

function SportContent() {
  const t = useTranslations('sportLanding')
  const tc = useTranslations('common')
  const locale = useLocale()

  const pricePro = formatEur(PRICE_PRO, locale)
  const priceBase = formatEur(PRICE_BASE, locale)
  const zones = (t.raw('dfa.zones') as TitledItem[]).map((z, i) => ({ ...z, ...ZONE_VISUALS[i] }))
  const liveFeatures = (t.raw('live.items') as string[]).map((text, i) => ({ text, icon: LIVE_ICONS[i] }))
  const postQuestions = (t.raw('post.items') as string[]).map((text, i) => ({ text, icon: POST_ICONS[i] }))
  const bands = (t.raw('dashboard.bands') as TitledItem[]).map((b, i) => ({ ...b, color: BAND_COLORS[i] }))
  const no = tc('no')

  const competitiveRows: { feature: string; kubios: string; hrv4: string; us: string; highlight?: boolean }[] = [
    { feature: t('compare.rows.dfa.feature'), kubios: t('compare.desktopOnly'), hrv4: no, us: `✅ ${t('compare.rows.dfa.us')}` },
    { feature: t('compare.rows.zones.feature'), kubios: no, hrv4: no, us: `✅ ${t('compare.rows.zones.us')}` },
    { feature: t('compare.rows.pain.feature'), kubios: no, hrv4: no, us: `✅ ${t('compare.rows.pain.us')}` },
    {
      feature: t('compare.rows.pdf.feature'),
      kubios: t('compare.rows.pdf.kubios', { price: formatEur(PRICE_KUBIOS_YEAR, locale) }),
      hrv4: no,
      us: `✅ ${t('compare.rows.pdf.us')}`,
    },
    { feature: t('compare.rows.gdpr.feature'), kubios: no, hrv4: no, us: '✅' },
    {
      feature: t('compare.rows.price.feature'),
      kubios: t('compare.rows.price.kubios', { price: formatEur(PRICE_KUBIOS_YEAR, locale) }),
      hrv4: t('compare.rows.price.hrv4', { price: formatEur(PRICE_HRV4_MONTH, locale) }),
      us: t('compare.rows.price.us', { price: pricePro }),
      highlight: true,
    },
  ]

  const stats = [
    { label: t('dashboard.stats.trimp'), value: '412' },
    { label: t('dashboard.stats.rpe'), value: num(6.2, 1, locale) },
    { label: t('dashboard.stats.sessions'), value: '14' },
  ]

  return (
    <div className="pt-16">
      {/* HERO: sfondo scuro anthracite */}
      <section className="bg-anthracite text-white pt-20 md:pt-28 pb-20 md:pb-24 px-6 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(79,163,154,0.45) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(232,93,74,0.25) 0%, transparent 50%)',
          }}
        />
        <div className="max-w-5xl mx-auto relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal/20 border border-teal/40 text-[12.5px] font-medium text-teal-light uppercase tracking-wider">
            <span aria-hidden="true">⚡</span>
            <span>{t('hero.badge')}</span>
          </div>
          <h1 className="mt-5 font-serif text-[40px] md:text-[60px] leading-[1.05] tracking-tight max-w-4xl">
            <Title lead={t('hero.titleLead')} em={t('hero.titleEm')} />
          </h1>
          <p className="mt-6 text-[18px] md:text-xl text-white/80 leading-relaxed max-w-2xl">
            {t('hero.body')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/registrazione"
              className="inline-flex items-center justify-center px-6 py-3.5 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark transition-colors"
            >
              {t('hero.ctaPro')}
              <span className="ml-2" aria-hidden="true">→</span>
            </Link>
            <a
              href="#dfa"
              className="inline-flex items-center px-2 py-3 text-white/90 font-medium hover:text-teal-light transition-colors"
            >
              {t('hero.ctaHow')}
              <span className="ml-1" aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="mt-5 text-sm text-white/60">
            {t('hero.note', { price: pricePro })}
          </p>
        </div>
      </section>

      {/* IL GAP */}
      <section className="py-16 md:py-24 px-6 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">⏳</span>
            <span>{t('gap.eyebrow')}</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            <Title lead={t('gap.titleLead')} em={t('gap.titleEm')} />
          </h2>
          <div className="mt-6 space-y-4 text-[17px] text-anthracite-light leading-relaxed">
            {(t.raw('gap.lines') as string[]).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="mt-8 rounded-xl border-l-4 border-teal bg-teal-light/50 px-5 py-4">
            <p className="text-[16px] font-medium text-anthracite leading-relaxed">
              {t('gap.callout')}
            </p>
          </div>
        </div>
      </section>

      {/* DFA ALPHA1 REAL-TIME */}
      <section id="dfa" className="py-16 md:py-24 px-6 border-b border-gray-100 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={t('dfa.eyebrow')}
            emoji="🎯"
            title={<Title lead={t('dfa.titleLead')} em={t('dfa.titleEm')} />}
            description={t('dfa.description')}
          />

          {/* Gradient banner */}
          <div className="mt-10 rounded-2xl overflow-hidden border border-gray-200">
            <div
              className="h-3 w-full"
              style={{
                background:
                  'linear-gradient(90deg, #10B981 0%, #10B981 25%, #F59E0B 25%, #F59E0B 50%, #F97316 50%, #F97316 75%, #EF4444 75%, #EF4444 100%)',
              }}
              aria-hidden="true"
            />
            <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {zones.map((z) => (
                <div key={z.title} className={`p-5 ${z.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden="true">{z.emoji}</span>
                    <span className={`font-mono text-[13px] font-semibold ${z.text}`}>{z.range}</span>
                  </div>
                  <h3 className="mt-2 font-semibold text-anthracite text-[15px] leading-tight">{z.title}</h3>
                  <p className="mt-1.5 text-[13.5px] text-anthracite-light leading-relaxed">{z.body}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-6 text-[15px] text-anthracite-light leading-relaxed max-w-3xl">
            {t('dfa.note')}
          </p>
        </div>
      </section>

      {/* SESSIONE LIVE */}
      <section className="py-16 md:py-24 px-6 border-b border-gray-100">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-start">
          <div>
            <SectionHeader
              eyebrow={t('live.eyebrow')}
              emoji="📊"
              title={<Title lead={t('live.titleLead')} em={t('live.titleEm')} />}
              description={t('live.description')}
            />
            <ul className="mt-8 space-y-4">
              {liveFeatures.map((f) => (
                <li key={f.text} className="flex gap-3 items-start">
                  <span className="text-xl flex-shrink-0" aria-hidden="true">{f.icon}</span>
                  <span className="text-[15.5px] text-anthracite leading-relaxed">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="rounded-2xl bg-anthracite p-5 text-white">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                  </span>
                  <span className="text-[13px] font-medium truncate">{t('live.mock.session')}</span>
                </div>
                <span className="text-[12px] font-mono text-white/60">42:18</span>
              </div>

              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <div className="text-[11px] uppercase tracking-wider text-white/60">DFA Alpha1</div>
                <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                  <span className="text-4xl font-semibold tabular-nums text-emerald-400">{num(0.82, 2, locale)}</span>
                  <span className="text-sm text-white/60">{t('live.mock.zone')}</span>
                </div>
                <div className="mt-3 h-2 rounded-full overflow-hidden bg-white/10">
                  <div className="h-full w-[78%] rounded-full bg-emerald-400" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/60">HR</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">142</div>
                  <div className="text-[11px] text-white/50">bpm</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/60">RMSSD</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">38</div>
                  <div className="text-[11px] text-white/50">{t('live.mock.rolling')}</div>
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-white/5 border border-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-white/60">{t('live.mock.tags')}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(t.raw('live.mock.tagItems') as string[]).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-teal/30 border border-teal/50 text-[11px] font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUESTIONARIO POST-ALLENAMENTO */}
      <section className="py-16 md:py-24 px-6 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={t('post.eyebrow')}
            emoji="🏋️"
            title={<Title lead={t('post.titleLead')} em={t('post.titleEm')} />}
            description={t('post.description')}
          />

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {postQuestions.map((q) => (
              <div key={q.text} className="rounded-xl border border-gray-200 bg-white p-5 flex items-start gap-3">
                <span className="text-2xl flex-shrink-0" aria-hidden="true">{q.icon}</span>
                <span className="text-[15px] text-anthracite leading-relaxed">{q.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border-l-4 border-teal bg-teal-light/50 px-5 py-4">
            <p className="text-[15.5px] text-anthracite leading-relaxed">
              <span className="font-semibold">{t('post.calloutLead')}</span> {t('post.calloutRest')}
            </p>
          </div>
        </div>
      </section>

      {/* DASHBOARD ATLETA 60 GIORNI */}
      <section className="py-16 md:py-24 px-6 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={t('dashboard.eyebrow')}
            emoji="📈"
            title={<Title lead={t('dashboard.titleLead')} em={t('dashboard.titleEm')} />}
            description={t('dashboard.description')}
          />

          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {bands.map((b) => (
              <div key={b.title} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${b.color}`} aria-hidden="true" />
                  <h3 className="font-semibold text-anthracite text-[15px]">{b.title}</h3>
                </div>
                <p className="mt-2 text-[14px] text-anthracite-light leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h3 className="font-semibold text-anthracite text-[15px]">{t('dashboard.chartTitle')}</h3>
              <span className="text-[12px] text-anthracite-lighter font-mono">
                baseline {num(4.05, 2, locale)} ± {num(0.3, 2, locale)}
              </span>
            </div>
            <svg viewBox="0 0 600 140" className="w-full h-32">
              <rect x="0" y="40" width="600" height="60" fill="#F0F9F8" />
              <line x1="0" y1="70" x2="600" y2="70" stroke="#4FA39A" strokeDasharray="3,3" strokeWidth="1" />
              <polyline
                fill="none"
                stroke="#2F343A"
                strokeWidth="1.5"
                points="10,60 40,72 70,55 100,80 130,68 160,42 190,58 220,90 250,75 280,55 310,38 340,62 370,72 400,95 430,68 460,52 490,40 520,58 550,72 580,50"
              />
              {[
                { x: 70, y: 55, c: '#10B981' },
                { x: 160, y: 42, c: '#10B981' },
                { x: 220, y: 90, c: '#EF4444' },
                { x: 310, y: 38, c: '#10B981' },
                { x: 400, y: 95, c: '#EF4444' },
                { x: 490, y: 40, c: '#10B981' },
              ].map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={p.c} />
              ))}
            </svg>
            <p className="mt-3 text-[13px] text-anthracite-lighter">
              {t('dashboard.chartNote')}
            </p>
          </div>

          <div className="mt-6 grid sm:grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="text-[11px] uppercase tracking-wider text-anthracite-lighter font-medium">{s.label}</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums text-anthracite">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PERCHÉ STRESS INDEX SPORT */}
      <section className="py-16 md:py-24 px-6 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={t('compare.eyebrow')}
            emoji="🆚"
            title={<Title lead={t('compare.titleLead')} em={t('compare.titleEm')} />}
          />

          <div className="mt-10 rounded-2xl border border-gray-200 bg-white overflow-x-auto">
            <table className="w-full text-[14.5px] min-w-[640px]">
              <thead className="bg-surface text-anthracite-lighter text-[12px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-4 font-medium">{t('compare.colFeature')}</th>
                  <th className="text-left px-5 py-4 font-medium">Kubios</th>
                  <th className="text-left px-5 py-4 font-medium">HRV4Training</th>
                  <th className="text-left px-5 py-4 font-medium bg-teal-light/40 text-teal-dark">
                    {tc('brand')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {competitiveRows.map((row) => (
                  <tr key={row.feature} className={row.highlight ? 'bg-teal-light/20 font-medium' : ''}>
                    <td className="px-5 py-4 text-anthracite font-medium">{row.feature}</td>
                    <td className="px-5 py-4 text-anthracite-light">{row.kubios}</td>
                    <td className="px-5 py-4 text-anthracite-light">{row.hrv4}</td>
                    <td className="px-5 py-4 text-anthracite font-semibold bg-teal-light/30">{row.us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* IN ARRIVO */}
      <section className="py-16 md:py-24 px-6 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={t('roadmap.eyebrow')}
            emoji="🔮"
            title={<Title lead={t('roadmap.titleLead')} em={t('roadmap.titleEm')} />}
            description={t('roadmap.description')}
          />

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(t.raw('roadmap.items') as string[]).map((r) => (
              <div key={r} className="rounded-xl border border-gray-200 bg-white px-5 py-4 flex items-start gap-3">
                <span className="text-teal font-semibold mt-0.5 flex-shrink-0" aria-hidden="true">›</span>
                <span className="text-[15px] text-anthracite leading-snug">{r}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border-l-4 border-teal bg-teal-light/50 px-5 py-4">
            <p className="text-[15.5px] text-anthracite leading-relaxed">
              <span aria-hidden="true">⭐</span> {t('roadmap.callout')}
            </p>
          </div>
        </div>
      </section>

      {/* CTA FINALE: sfondo teal */}
      <section className="py-20 md:py-28 px-6 bg-teal text-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-white/90 uppercase tracking-wider">
            <span aria-hidden="true">🚀</span>
            <span>{t('cta.eyebrow')}</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-5xl leading-tight tracking-tight">
            <Title lead={t('cta.titleLead')} em={t('cta.titleEm')} emClass="text-teal-light" />
          </h2>
          <p className="mt-5 text-[18px] text-white/85 leading-relaxed">
            {t('cta.note1', { price: pricePro })}
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/registrazione"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-teal-dark font-semibold rounded-lg hover:bg-teal-light transition-colors text-[16px]"
            >
              {t('hero.ctaPro')}
              <span className="ml-2" aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="mt-5 text-sm text-white/70">
            {t('cta.note2', { base: priceBase })}
          </p>
          <p className="mt-3 text-sm text-white/70">
            <Link href="/funzionalita" className="underline underline-offset-2 hover:text-white">
              {t('cta.linkFeatures')}
            </Link>
            <span className="mx-2" aria-hidden="true">·</span>
            <Link href="/guide" className="underline underline-offset-2 hover:text-white">
              {tc('nav.guidesAndSupport')}
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}

export default function SportPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale)
  return (
    <main className="bg-white text-anthracite">
      <Header />
      <SportContent />
      <Footer />
    </main>
  )
}
