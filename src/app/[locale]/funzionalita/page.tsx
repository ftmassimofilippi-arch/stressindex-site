import type { Metadata } from 'next'
import { useLocale, useTranslations } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'
import { formatEur } from '@/lib/format'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'meta' })
  return pageMetadata({
    locale: params.locale as Locale,
    path: '/funzionalita',
    title: t('features.title'),
    description: t('features.description'),
    shortDescription: t('features.shortDescription'),
  })
}

// Parte visiva dei 5 score: i nomi e le descrizioni vengono da features.scores.items (stesso ordine).
const SCORE_VISUALS = [
  { emoji: '🔴', accent: '#E85D4A' },
  { emoji: '🟢', accent: '#10B981' },
  { emoji: '🔵', accent: '#3B82F6' },
  { emoji: '🟠', accent: '#F59E0B' },
  { emoji: '🟣', accent: '#A855F7' },
]
const SCORE_RANGE = '0-100'

// Sigle dei parametri: invarianti in tutte le lingue.
const HRV_GROUPS = [
  { key: 'time', emoji: '⏱️', items: ['RMSSD', 'SDNN', 'Mean HR', 'pNN50', 'pNN20', 'HRV-CV', 'RMSSD/SDNN'] },
  { key: 'frequency', emoji: '📡', note: 'FFT Welch + Lomb-Scargle', items: ['LF Power', 'HF Power', 'VLF Power', 'Total Power', 'LF/HF', 'LF norm', 'HF norm'] },
  { key: 'nonlinear', emoji: '🌀', items: ['DFA Alpha1', 'DFA Alpha2', 'SD1', 'SD2', 'SD1/SD2', 'Sample Entropy', 'Approximate Entropy'] },
  { key: 'geometric', emoji: '📐', items: ['Stress Index Baevsky', 'Triangular Index', 'TINN'] },
] as const

const TEST_EMOJIS = ['📷', '🧍', '🌬️', '⏳']
const PRIVACY_ICONS = ['🇪🇺', '📜', '🔐', '🚫']

type SensorStatus = 'ok' | 'limit' | 'no'
// Prezzi indicativi in EUR; `price` va accanto al nome, `notePrice` dentro la nota.
const SENSORS: { id: string; status: SensorStatus; price?: number; notePrice?: number }[] = [
  { id: 'h10', status: 'ok', price: 90 },
  { id: 'h9', status: 'ok', price: 50 },
  { id: 'oh1', status: 'ok' },
  { id: 'tickr', status: 'limit' },
  { id: 'coospo', status: 'limit', notePrice: 30 },
  { id: 'whoop', status: 'no' },
  { id: 'garmin', status: 'no' },
  { id: 'watch', status: 'no' },
]

type NamedItem = { name: string; description: string }
type TitledItem = { title: string; body: string }

function SensorBadge({ s }: { s: SensorStatus }) {
  const t = useTranslations('features.sensors.status')
  if (s === 'ok')
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium text-[13.5px]">
        <span aria-hidden="true">✅</span> {t('ok')}
      </span>
    )
  if (s === 'limit')
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium text-[13.5px]">
        <span aria-hidden="true">⚠️</span> {t('limit')}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 text-rose-700 font-medium text-[13.5px]">
      <span aria-hidden="true">❌</span> {t('no')}
    </span>
  )
}

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

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-l-4 border-teal bg-teal-light/50 px-5 py-4 text-[15px] text-anthracite leading-relaxed">
      {children}
    </div>
  )
}

function Title({ lead, em }: { lead: string; em: string }) {
  return (
    <>
      {lead} <em className="italic text-teal">{em}</em>
    </>
  )
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3 text-[15px] text-anthracite-light">
      {items.map((it) => (
        <li key={it} className="flex gap-2.5">
          <span className="text-teal font-semibold mt-0.5" aria-hidden="true">✓</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

function FunzionalitaContent() {
  const t = useTranslations('features')
  const tc = useTranslations('common')
  const ts = useTranslations('scores.names')
  const locale = useLocale()

  const scores = (t.raw('scores.items') as NamedItem[]).map((s, i) => ({ ...s, ...SCORE_VISUALS[i] }))
  const tests = (t.raw('tests.items') as TitledItem[]).map((s, i) => ({ ...s, emoji: TEST_EMOJIS[i], badge: i === 3 ? tc('new') : null }))
  const privacyItems = (t.raw('privacy.items') as TitledItem[]).map((p, i) => ({ ...p, icon: PRIVACY_ICONS[i] }))
  const dashboardScores = [
    { l: ts('stress'), v: 72, c: '#E85D4A' },
    { l: ts('recovery'), v: 68, c: '#10B981' },
    { l: ts('balance'), v: 55, c: '#3B82F6' },
    { l: ts('energy'), v: 63, c: '#F59E0B' },
  ]

  return (
    <div className="pt-16">
      {/* HERO */}
      <section className="pt-16 md:pt-24 pb-12 md:pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-teal-dark">
            <span aria-hidden="true">✨</span>
            <span>{t('hero.eyebrow')}</span>
          </div>
          <h1 className="mt-4 font-serif text-[36px] md:text-[52px] leading-[1.08] tracking-tight text-anthracite max-w-4xl">
            <Title lead={t('hero.titleLead')} em={t('hero.titleEm')} />
          </h1>
          <p className="mt-5 text-[17px] md:text-lg text-anthracite-light leading-relaxed max-w-2xl">
            {t('hero.body')}
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
              href="#score"
              className="inline-flex items-center px-2 py-3 text-anthracite font-medium hover:text-teal transition-colors"
            >
              {t('hero.ctaHow')}
              <span className="ml-1" aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
      </section>

      {/* SEZIONE 1: 5 SCORE PROPRIETARI */}
      <section id="score" className="py-16 md:py-24 px-6 border-t border-gray-100 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={t('scores.eyebrow')}
            emoji="📊"
            title={<Title lead={t('scores.titleLead')} em={t('scores.titleEm')} />}
            description={t('scores.description')}
          />

          <div className="mt-12 grid md:grid-cols-2 gap-5">
            {scores.map((s) => (
              <div
                key={s.name}
                className="rounded-xl border border-gray-200 bg-white p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">{s.emoji}</span>
                  <h3 className="text-lg font-semibold text-anthracite tracking-tight">{s.name}</h3>
                  <span className="text-xs text-anthracite-lighter font-mono tabular-nums ml-auto">{SCORE_RANGE}</span>
                </div>
                <p className="mt-3 text-[15px] text-anthracite-light leading-relaxed">{s.description}</p>
                <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: '62%', backgroundColor: s.accent }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEZIONE 2: 25+ PARAMETRI HRV */}
      <section className="py-16 md:py-24 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={t('params.eyebrow')}
            emoji="🔬"
            title={<Title lead={t('params.titleLead')} em={t('params.titleEm')} />}
            description={t('params.description')}
          />

          <div className="mt-12 grid md:grid-cols-2 gap-5">
            {HRV_GROUPS.map((g) => (
              <div key={g.key} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">{g.emoji}</span>
                  <h3 className="text-lg font-semibold text-anthracite tracking-tight">{t(`params.groups.${g.key}`)}</h3>
                </div>
                {'note' in g ? (
                  <p className="mt-1 text-[12px] text-anthracite-lighter font-mono">{g.note}</p>
                ) : null}
                <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[14px] text-anthracite-light">
                  {g.items.map((it) => (
                    <li key={it} className="flex items-center gap-2">
                      <span className="text-teal text-xs" aria-hidden="true">●</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Callout>
              <span className="font-medium">💡 {t('params.calloutLead')}</span> {t('params.calloutBody')}
            </Callout>
          </div>
        </div>
      </section>

      {/* SEZIONE 3: TIPI DI TEST */}
      <section className="py-16 md:py-24 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={t('tests.eyebrow')}
            emoji="🩺"
            title={<Title lead={t('tests.titleLead')} em={t('tests.titleEm')} />}
            description={t('tests.description')}
          />

          <div className="mt-12 grid md:grid-cols-2 gap-5">
            {tests.map((test) => (
              <div key={test.title} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">{test.emoji}</span>
                  <h3 className="text-lg font-semibold text-anthracite tracking-tight">{test.title}</h3>
                  {test.badge ? (
                    <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-teal text-white text-[11px] font-medium uppercase tracking-wider">
                      {test.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-[15px] text-anthracite-light leading-relaxed">{test.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-[14.5px] text-anthracite-lighter">
            {t('tests.athletesNote')}{' '}
            <Link href="/sport" className="text-teal-dark font-medium hover:text-teal hover:underline">
              {t('tests.athletesCta')} →
            </Link>
          </p>
        </div>
      </section>

      {/* SEZIONE 4: REPORT PDF */}
      <section className="py-16 md:py-24 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <SectionHeader
              eyebrow={t('pdf.eyebrow')}
              emoji="📋"
              title={<Title lead={t('pdf.titleLead')} em={t('pdf.titleEm')} />}
            />
            <p className="mt-5 text-[17px] text-anthracite-light leading-relaxed">
              {t('pdf.body')}
            </p>
            <CheckList items={t.raw('pdf.items') as string[]} />
          </div>
          <div>
            <div className="rounded-2xl bg-white border border-gray-200 p-6">
              <div className="rounded-lg border border-gray-100 bg-surface aspect-[3/4] p-5 flex flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-teal" />
                    <span className="text-[11px] font-semibold text-anthracite">{tc('brand')}</span>
                  </div>
                  <span className="text-[10px] text-anthracite-lighter">{t('pdf.mockReport')}</span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {scores.slice(0, 4).map((s) => (
                    <div key={s.name} className="rounded bg-white border border-gray-200 p-2">
                      <div className="text-[9px] uppercase text-anthracite-lighter tracking-wider truncate">
                        {s.name}
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: '64%', backgroundColor: s.accent }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-4 text-[10px] text-anthracite-lighter">
                  {t('pdf.mockFooter')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEZIONE 5: CRM */}
      <section className="py-16 md:py-24 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={t('crm.eyebrow')}
            emoji="👥"
            title={<Title lead={t('crm.titleLead')} em={t('crm.titleEm')} />}
            description={t('crm.description')}
          />

          <div className="mt-10 grid md:grid-cols-2 gap-5">
            {(t.raw('crm.items') as string[]).map((f) => (
              <div key={f} className="rounded-xl border border-gray-200 bg-white px-5 py-4 flex items-start gap-3">
                <span className="text-teal font-semibold mt-0.5" aria-hidden="true">✓</span>
                <span className="text-[15px] text-anthracite">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEZIONE 6: DASHBOARD WEB */}
      <section className="py-16 md:py-24 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1">
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <div className="rounded-lg border border-gray-100 bg-surface overflow-hidden">
                <div className="bg-anthracite px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="ml-3 text-[11px] text-white/70 font-mono">stressindex.io/dashboard</span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  {dashboardScores.map((s) => (
                    <div key={s.l} className="rounded-md bg-white border border-gray-200 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-anthracite-lighter truncate">{s.l}</div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-semibold tabular-nums">{s.v}</span>
                        <span className="text-[10px] text-anthracite-lighter">/100</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.v}%`, backgroundColor: s.c }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <div className="rounded bg-white border border-gray-200 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-anthracite-lighter">{t('dashboard.trendLabel')}</div>
                    <svg viewBox="0 0 200 50" className="mt-2 w-full h-12">
                      <polyline
                        fill="none"
                        stroke="#4FA39A"
                        strokeWidth="1.5"
                        points="0,30 20,32 40,25 60,28 80,20 100,22 120,18 140,24 160,15 180,18 200,12"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <SectionHeader
              eyebrow={t('dashboard.eyebrow')}
              emoji="🌐"
              title={<Title lead={t('dashboard.titleLead')} em={t('dashboard.titleEm')} />}
            />
            <p className="mt-5 text-[17px] text-anthracite-light leading-relaxed">
              {t('dashboard.body')}
            </p>
            <CheckList items={t.raw('dashboard.items') as string[]} />
          </div>
        </div>
      </section>

      {/* SEZIONE 7: SICUREZZA E PRIVACY */}
      <section className="py-16 md:py-24 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={t('privacy.eyebrow')}
            emoji="🔒"
            title={<Title lead={t('privacy.titleLead')} em={t('privacy.titleEm')} />}
            description={t('privacy.description')}
          />

          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {privacyItems.map((p) => (
              <div key={p.title} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="text-2xl" aria-hidden="true">{p.icon}</div>
                <h3 className="mt-3 font-semibold text-anthracite">{p.title}</h3>
                <p className="mt-1.5 text-[14px] text-anthracite-light leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEZIONE 8: SENSORI */}
      <section className="py-16 md:py-24 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={t('sensors.eyebrow')}
            emoji="📡"
            title={<Title lead={t('sensors.titleLead')} em={t('sensors.titleEm')} />}
            description={t('sensors.description')}
          />

          <div className="mt-10">
            <Callout>
              <span className="font-medium">💡 {t('sensors.calloutLead')}</span>{' '}
              {t.rich('sensors.calloutBody', {
                link: (chunks) => (
                  <Link href="/guide" className="text-teal-dark font-medium hover:underline">
                    {chunks}
                  </Link>
                ),
              })}
            </Callout>
          </div>

          <div className="mt-8 rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-[14.5px]">
              <thead className="bg-surface text-anthracite-lighter text-[12px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">{t('sensors.table.sensor')}</th>
                  <th className="text-left px-5 py-3 font-medium">{t('sensors.table.status')}</th>
                  <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">{t('sensors.table.notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {SENSORS.map((s) => {
                  const name = t(`sensors.items.${s.id}.name`)
                  const label = s.price != null ? `${name} (${formatEur(s.price, locale)})` : name
                  const note = t(`sensors.items.${s.id}.note`, { price: s.notePrice != null ? formatEur(s.notePrice, locale) : '' })
                  return (
                    <tr key={s.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-anthracite">{label}</td>
                      <td className="px-5 py-3">
                        <SensorBadge s={s.status} />
                      </td>
                      <td className="px-5 py-3 text-anthracite-light hidden sm:table-cell">{note}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section className="py-16 md:py-24 px-6 border-t border-gray-100">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-teal-light/50 border border-teal-mid/40 p-8 md:p-12 text-center">
            <div className="inline-flex items-center gap-2 text-[13px] font-medium text-teal-dark uppercase tracking-wider">
              <span aria-hidden="true">🚀</span>
              <span>{t('cta.eyebrow')}</span>
            </div>
            <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
              <Title lead={t('cta.titleLead')} em={t('cta.titleEm')} />
            </h2>
            <p className="mt-4 text-[17px] text-anthracite-light leading-relaxed">
              {t('cta.body')}
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/registrazione"
                className="inline-flex items-center justify-center px-6 py-3 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark transition-colors"
              >
                {t('cta.button')}
                <span className="ml-2" aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="mt-4 text-sm text-anthracite-lighter">
              {tc('trialNote')}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function FunzionalitaPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale)
  return (
    <main className="bg-white text-anthracite">
      <Header />
      <FunzionalitaContent />
      <Footer />
    </main>
  )
}
