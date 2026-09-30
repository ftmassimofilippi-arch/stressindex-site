'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import GuideChatWidget from '@/components/GuideChatWidget'
import {
  blocksToText,
  faqToText,
  type ColorName,
  type GuideBlock,
  type GuideFaqItem,
  type GuideSection,
  type SensorStatus,
} from './guide-content'

// Il contenuto della guida vive nei file messaggi (namespace `guide`,
// `sections` e `faq`) come blocchi tipizzati; qui c'è solo il renderer.
// Gli id delle sezioni (anchor) sono invariati in tutte le lingue.

const COLORS: Record<ColorName, string> = {
  teal: '#4FA39A',
  amber: '#F59E0B',
  indigo: '#6366F1',
  red: '#E85D4A',
  blue: '#3B82F6',
  orange: '#F97316',
  purple: '#A855F7',
  green: '#22C55E',
  yellow: '#EAB308',
}

const LINK_CLASS = 'text-teal hover:text-teal-dark underline'

/** Markup inline minimo: `**grassetto**` e `[testo](href)`. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean)
  return (
    <>
      {parts.map((part, i) => {
        const bold = /^\*\*(.+)\*\*$/.exec(part)
        if (bold) {
          return (
            <span key={i} className="font-medium text-anthracite">
              {bold[1]}
            </span>
          )
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (link) {
          const [, label, href] = link
          if (href.startsWith('/')) {
            return (
              <Link key={i} href={href} className={LINK_CLASS}>
                {label}
              </Link>
            )
          }
          const external = /^https?:/.test(href)
          return (
            <a
              key={i}
              href={href}
              className={LINK_CLASS}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {label}
            </a>
          )
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-md border-2 border-teal/40 bg-teal-light flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12L10 17L19 7" stroke="#2E746C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-[15px] text-anthracite-light leading-relaxed">
            <Inline text={item} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3.5">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-teal text-white text-[13px] font-semibold flex items-center justify-center">
            {i + 1}
          </span>
          <span className="pt-0.5 text-[15px] text-anthracite-light leading-relaxed">
            <Inline text={item} />
          </span>
        </li>
      ))}
    </ol>
  )
}

function TroubleshootBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <p className="font-medium text-anthracite mb-3 flex items-start gap-2">
        <span aria-hidden="true">🔧</span>
        <span>&ldquo;{title}&rdquo;</span>
      </p>
      <ul className="space-y-2">
        {items.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-[14.5px] text-anthracite-light leading-relaxed">
            <span className="text-teal mt-0.5">→</span>
            <span>
              <Inline text={b} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Callout({ title, text, variant = 'info' }: { title?: string; text: string; variant?: 'info' | 'warn' }) {
  const isWarn = variant === 'warn'
  return (
    <div
      className={`rounded-lg p-4 sm:p-5 border-l-4 flex items-start gap-3 ${
        isWarn ? 'bg-amber-50 border-amber-400' : 'bg-teal-light/60 border-teal'
      }`}
    >
      <span aria-hidden="true" className="text-lg leading-none mt-0.5">
        {isWarn ? '⚠️' : '💡'}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className={`font-semibold mb-1 ${isWarn ? 'text-amber-900' : 'text-teal-dark'}`}>{title}</p>}
        <div className={`text-[14.5px] leading-relaxed ${isWarn ? 'text-amber-900/90' : 'text-anthracite'}`}>
          <Inline text={text} />
        </div>
      </div>
    </div>
  )
}

function ScoreCard({
  emoji,
  title,
  desc,
  ranges,
  color,
}: {
  emoji: string
  title: string
  desc: string
  ranges?: { range: string; label: string }[]
  color: ColorName
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 min-w-0">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-xl" aria-hidden="true">
          {emoji}
        </span>
        <h4 className="font-semibold text-anthracite">{title}</h4>
      </div>
      <p className="text-[14.5px] text-anthracite-light leading-relaxed">{desc}</p>
      {ranges && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          {ranges.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px]">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[color], opacity: 0.4 + i * 0.15 }}
                aria-hidden="true"
              />
              <span className="font-mono text-anthracite tabular-nums">{r.range}</span>
              <span className="text-anthracite-light">{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ZoneCard({ emoji, title, desc, color }: { emoji: string; title: string; desc: string; color: ColorName }) {
  return (
    <div className="rounded-xl border bg-white p-5 border-l-4 min-w-0" style={{ borderLeftColor: COLORS[color] }}>
      <div className="flex items-center gap-2.5 mb-1.5">
        <span className="text-xl" aria-hidden="true">
          {emoji}
        </span>
        <h4 className="font-semibold text-anthracite">{title}</h4>
      </div>
      <p className="text-[14.5px] text-anthracite-light leading-relaxed">{desc}</p>
    </div>
  )
}

function StatusBadge({ s }: { s: SensorStatus }) {
  const t = useTranslations('guide.sensorStatus')
  const cls =
    s === 'ok' ? 'text-emerald-700' : s === 'limit' ? 'text-amber-700' : 'text-rose-700'
  const icon = s === 'ok' ? '✅' : s === 'limit' ? '⚠️' : '❌'
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium text-[13.5px] ${cls}`}>
      <span aria-hidden="true">{icon}</span> {t(s)}
    </span>
  )
}

function SensorTable({ block }: { block: Extract<GuideBlock, { type: 'sensorTable' }> }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-[13px] uppercase tracking-wider text-anthracite-lighter font-semibold">
          <tr>
            <th className="px-4 py-3">{block.headers.sensor}</th>
            <th className="px-4 py-3 hidden sm:table-cell">{block.headers.status}</th>
            <th className="px-4 py-3">{block.headers.notes}</th>
          </tr>
        </thead>
        <tbody className="text-[14.5px]">
          {block.rows.map((s) => (
            <tr key={s.name} className="bg-white border-t border-gray-100">
              <td className="px-4 py-3 align-top">
                <div className="font-medium text-anthracite font-mono">{s.name}</div>
                <div className="sm:hidden mt-1">
                  <StatusBadge s={s.status} />
                </div>
              </td>
              <td className="px-4 py-3 align-top hidden sm:table-cell">
                <StatusBadge s={s.status} />
              </td>
              <td className="px-4 py-3 align-top text-anthracite-light">{s.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-[13px] uppercase tracking-wider text-anthracite-lighter font-semibold">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-[14.5px]">
          {rows.map((row, i) => (
            <tr key={i} className="bg-white border-t border-gray-100">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 align-top ${j === 0 ? 'font-medium text-anthracite' : 'text-anthracite-light'}`}
                >
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ContactIcon({ icon }: { icon: 'email' | 'telegram' | 'site' }) {
  if (icon === 'email')
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6L12 13L20 6M4 6V18H20V6M4 6H20" stroke="#4FA39A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  if (icon === 'telegram')
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 4L3 11L10 14L13 21L21 4Z" stroke="#4FA39A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#4FA39A" strokeWidth="2" />
      <path d="M3 12H21M12 3C14.5 6 14.5 18 12 21M12 3C9.5 6 9.5 18 12 21" stroke="#4FA39A" strokeWidth="2" />
    </svg>
  )
}

function Contacts({ items }: { items: Extract<GuideBlock, { type: 'contacts' }>['items'] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {items.map((c, i) => (
        <a
          key={i}
          href={c.href}
          {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className={`block rounded-xl border border-gray-200 bg-white p-5 hover:border-teal transition-colors min-w-0 ${
            i === items.length - 1 && items.length % 2 === 1 ? 'sm:col-span-2' : ''
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <ContactIcon icon={c.icon} />
            <span className="font-medium text-anthracite">{c.title}</span>
          </div>
          <p className="text-[14px] text-anthracite-light break-words">{c.text}</p>
        </a>
      ))}
    </div>
  )
}

function AccordionItem({
  q,
  children,
  open,
  onToggle,
}: {
  q: string
  children: React.ReactNode
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-gray-100">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-2 py-4 text-left hover:text-teal transition-colors focus:outline-none"
      >
        <span className="font-medium text-anthracite">{q}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`text-anthracite-lighter flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-2 pb-5 pt-0 -mt-1 text-[15px] text-anthracite-light leading-relaxed animate-fade-in space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

function StandaloneFaq({ items }: { items: GuideFaqItem[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  return (
    <div className="space-y-0">
      {items.map((it, i) => (
        <AccordionItem key={i} q={it.q} open={open.has(i)} onToggle={() => toggle(i)}>
          <Blocks blocks={it.a} compact />
        </AccordionItem>
      ))}
    </div>
  )
}

/** Spaziatura verticale fra blocchi consecutivi (heading vs. resto). */
function spacing(block: GuideBlock, i: number, compact: boolean): string {
  if (i === 0) return ''
  if (block.type === 'h3') return 'mt-8'
  return compact ? 'mt-2' : 'mt-5'
}

function Blocks({
  blocks,
  compact = false,
  mainFaq,
}: {
  blocks: GuideBlock[]
  /** Dentro le risposte delle FAQ: testo più stretto, meno spazio. */
  compact?: boolean
  mainFaq?: React.ReactNode
}) {
  const pClass = compact
    ? ''
    : 'text-[15.5px] text-anthracite-light leading-relaxed'
  return (
    <>
      {blocks.map((b, i) => {
        const cls = spacing(b, i, compact)
        switch (b.type) {
          case 'p':
            return (
              <p key={i} className={`${pClass} ${cls}`}>
                <Inline text={b.text} />
              </p>
            )
          case 'h3':
            return (
              <h3 key={i} className={`text-lg font-semibold text-anthracite mb-4 ${cls}`}>
                {b.text}
              </h3>
            )
          case 'ul':
            return (
              <ul key={i} className={`list-disc pl-5 space-y-1.5 text-[15px] text-anthracite-light leading-relaxed ${cls}`}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            )
          case 'steps':
            return (
              <div key={i} className={cls}>
                <Steps items={b.items} />
              </div>
            )
          case 'checklist':
            return (
              <div key={i} className={cls}>
                <Checklist items={b.items} />
              </div>
            )
          case 'callout':
            return (
              <div key={i} className={cls}>
                <Callout title={b.title} text={b.text} variant={b.variant} />
              </div>
            )
          case 'troubleshoot':
            return (
              <div key={i} className={i > 0 && blocks[i - 1].type === 'troubleshoot' ? 'mt-3' : cls}>
                <TroubleshootBlock title={b.title} items={b.items} />
              </div>
            )
          case 'sensorTable':
            return (
              <div key={i} className={cls}>
                <SensorTable block={b} />
              </div>
            )
          case 'table':
            return (
              <div key={i} className={cls}>
                <SimpleTable headers={b.headers} rows={b.rows} />
              </div>
            )
          case 'scoreCards':
            return (
              <div key={i} className={`grid sm:grid-cols-2 gap-4 ${cls}`}>
                {b.items.map((c, j) => (
                  <ScoreCard key={j} {...c} />
                ))}
              </div>
            )
          case 'zoneCards':
            return (
              <div key={i} className={`grid sm:grid-cols-2 gap-4 ${cls}`}>
                {b.items.map((c, j) => (
                  <ZoneCard key={j} {...c} />
                ))}
              </div>
            )
          case 'card':
            return (
              <div
                key={i}
                className={`rounded-xl border border-gray-200 bg-white p-5 sm:p-6 ${
                  i > 0 && blocks[i - 1].type === 'card' ? 'mt-4' : cls
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[b.color] }} />
                  <h4 className="text-lg font-semibold text-anthracite">{b.title}</h4>
                </div>
                <Blocks blocks={b.blocks} compact />
              </div>
            )
          case 'dl':
            return (
              <dl key={i} className={`space-y-3 text-[15px] text-anthracite-light leading-relaxed ${cls}`}>
                {b.items.map((d, j) => (
                  <div key={j}>
                    <dt className="font-medium text-anthracite">{d.term}</dt>
                    <dd>
                      <Inline text={d.desc} />
                    </dd>
                  </div>
                ))}
              </dl>
            )
          case 'faq':
            return (
              <div key={i} className={cls}>
                <StandaloneFaq items={b.items} />
              </div>
            )
          case 'contacts':
            return (
              <div key={i} className={cls}>
                <Contacts items={b.items} />
              </div>
            )
          case 'mainFaq':
            return (
              <div key={i} className="mt-6 space-y-3">
                {mainFaq}
              </div>
            )
          default:
            return null
        }
      })}
    </>
  )
}

export default function GuideClient() {
  const t = useTranslations('guide')
  const sections = useMemo(() => t.raw('sections') as GuideSection[], [t])
  const faqItems = useMemo(() => t.raw('faq') as GuideFaqItem[], [t])

  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? 'sensori')
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set())
  const [showBackTop, setShowBackTop] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const toggleFaq = (i: number) => {
    setOpenFaqs((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  // Testo di ricerca generato dal contenuto nella lingua corrente.
  const faqSearch = useMemo(() => faqItems.map((f) => faqToText(f).toLowerCase()), [faqItems])
  const sectionSearch = useMemo(
    () => sections.map((s) => `${s.title} ${blocksToText(s.blocks)}`.toLowerCase()),
    [sections]
  )

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return faqItems.map((_, i) => i)
    return faqItems.map((_, i) => i).filter((i) => faqSearch[i].includes(q))
  }, [query, faqItems, faqSearch])

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections.filter((s, i) => {
      if (s.id === 'problemi' && filteredFaqs.length > 0) return true
      return sectionSearch[i].includes(q)
    })
  }, [query, sections, sectionSearch, filteredFaqs.length])

  // Scroll-spy: evidenzia la sezione attiva nell'indice
  useEffect(() => {
    const ids = sections.map((s) => s.id)
    const onScroll = () => {
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        const top = el.getBoundingClientRect().top
        if (top - 120 <= 0) current = id
      }
      setActiveId(current)
      setShowBackTop(window.scrollY > 400)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sections])

  // Smooth scroll (compensa header sticky 64px)
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top: y, behavior: 'smooth' })
    setMobileNavOpen(false)
  }

  // Apre automaticamente le FAQ trovate dalla ricerca
  useEffect(() => {
    if (query.trim() && filteredFaqs.length > 0) {
      setOpenFaqs(new Set(filteredFaqs))
    }
  }, [query, filteredFaqs])

  const noResults = filteredSections.length === 0
  const activeSection = sections.find((s) => s.id === activeId)

  const mainFaq = (
    <>
      {filteredFaqs.length === 0 && (
        <p className="text-[14.5px] text-anthracite-lighter italic">{t('search.noFaq')}</p>
      )}
      {filteredFaqs.map((i) => (
        <AccordionItem key={i} q={faqItems[i].q} open={openFaqs.has(i)} onToggle={() => toggleFaq(i)}>
          <Blocks blocks={faqItems[i].a} compact />
        </AccordionItem>
      ))}
    </>
  )

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white pt-16">
        {/* Hero */}
        <div className="border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-6 pt-12 sm:pt-16 pb-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider mb-4">
                <span aria-hidden="true">📚</span>
                <span>{t('hero.eyebrow')}</span>
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl font-normal text-anthracite tracking-tight">
                {t('hero.title')}
              </h1>
              <p className="mt-4 text-lg text-anthracite-light leading-relaxed">{t('hero.subtitle')}</p>

              {/* Search */}
              <div className="mt-8 relative max-w-xl">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-anthracite-lighter pointer-events-none"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M21 21L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  inputMode="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('hero.searchPlaceholder')}
                  className="w-full pl-11 pr-11 py-3 bg-white border border-gray-200 rounded-lg text-anthracite placeholder:text-anthracite-lighter focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-colors"
                  aria-label={t('hero.searchLabel')}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-anthracite-lighter hover:text-anthracite p-1 rounded-md"
                    aria-label={t('hero.clearSearch')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        <div className="md:hidden sticky top-16 z-30 bg-white/95 backdrop-blur border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-6 py-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-expanded={mobileNavOpen}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-left"
            >
              <span className="text-[14.5px] font-medium text-anthracite truncate min-w-0">
                {activeSection ? `${activeSection.emoji} ${activeSection.title}` : t('nav.sections')}
              </span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className={`flex-shrink-0 transition-transform ${mobileNavOpen ? 'rotate-180' : ''} text-anthracite-lighter`}
              >
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {mobileNavOpen && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollToSection(s.id)}
                    className={`w-full text-left px-4 py-2.5 text-[14.5px] border-t border-gray-100 first:border-t-0 flex items-center gap-2 ${
                      activeId === s.id ? 'bg-teal-light/60 text-teal-dark font-medium' : 'text-anthracite hover:bg-surface'
                    }`}
                  >
                    <span aria-hidden="true">{s.emoji}</span>
                    <span>{s.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content layout */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="grid md:grid-cols-[230px_1fr] gap-10">
            {/* Sidebar desktop */}
            <aside className="hidden md:block">
              <nav aria-label={t('nav.indexLabel')} className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-auto pr-2">
                <p className="text-[12px] uppercase tracking-wider text-anthracite-lighter font-semibold mb-3">{t('nav.index')}</p>
                <ul className="space-y-0.5">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => scrollToSection(s.id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-[14px] transition-colors flex items-center gap-2.5 ${
                          activeId === s.id
                            ? 'bg-teal-light text-teal-dark font-medium'
                            : 'text-anthracite-light hover:bg-gray-50 hover:text-anthracite'
                        }`}
                      >
                        <span aria-hidden="true" className="text-base leading-none">
                          {s.emoji}
                        </span>
                        <span className="min-w-0">{s.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            {/* Sections */}
            <div className="min-w-0 max-w-3xl">
              {noResults && (
                <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center bg-white">
                  <p className="text-anthracite font-medium">{t('search.noResultsTitle', { query })}</p>
                  <p className="mt-1 text-[14px] text-anthracite-light">
                    {t.rich('search.noResultsBody', {
                      link: (chunks) => (
                        <a href="mailto:support@stressindex.io" className={LINK_CLASS}>
                          {chunks}
                        </a>
                      ),
                    })}
                  </p>
                </div>
              )}

              <div className="space-y-16">
                {filteredSections.map((s, i) => (
                  <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
                    <div className="group flex items-baseline gap-3 mb-5">
                      <h2
                        id={`${s.id}-title`}
                        className="text-2xl sm:text-3xl font-bold text-anthracite tracking-tight flex items-center gap-3"
                      >
                        <span aria-hidden="true" className="text-3xl leading-none">
                          {s.emoji}
                        </span>
                        <span>{s.title}</span>
                      </h2>
                      <a
                        href={`#${s.id}`}
                        aria-label={t('nav.anchorLabel')}
                        className="ml-auto text-anthracite-lighter hover:text-teal transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-60 w-10 h-10 -mr-2 inline-flex items-center justify-center"
                      >
                        #
                      </a>
                    </div>
                    <div className="text-anthracite">
                      <Blocks blocks={s.blocks} mainFaq={s.id === 'problemi' ? mainFaq : undefined} />
                    </div>
                    {i < filteredSections.length - 1 && <div className="mt-16 border-t border-gray-100" />}
                  </section>
                ))}
              </div>

              {/* Vedi anche */}
              <section aria-labelledby="vedi-anche-title" className="mt-20 rounded-xl border border-gray-200 bg-white p-6">
                <h2 id="vedi-anche-title" className="text-lg font-semibold text-anthracite tracking-tight">
                  {t('seeAlso.title')}
                </h2>
                <p className="mt-1.5 text-[14.5px] text-anthracite-light leading-relaxed">{t('seeAlso.subtitle')}</p>
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <Link href="/funzionalita" className="block rounded-lg border border-gray-200 p-4 hover:border-teal transition-colors min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span aria-hidden="true">✨</span>
                      <span className="font-medium text-anthracite">{t('seeAlso.features.title')}</span>
                    </div>
                    <p className="text-[13.5px] text-anthracite-light leading-relaxed">{t('seeAlso.features.desc')}</p>
                  </Link>
                  <Link href="/sport" className="block rounded-lg border border-gray-200 p-4 hover:border-teal transition-colors min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span aria-hidden="true">⚡</span>
                      <span className="font-medium text-anthracite">{t('seeAlso.sport.title')}</span>
                    </div>
                    <p className="text-[13.5px] text-anthracite-light leading-relaxed">{t('seeAlso.sport.desc')}</p>
                  </Link>
                </div>
              </section>

              {/* AI assistant promo */}
              <section
                aria-labelledby="ai-help-title"
                className="mt-8 rounded-lg border-l-4 border-teal bg-teal-light/40 p-5 sm:p-6 flex items-start gap-4"
              >
                <span aria-hidden="true" className="text-2xl leading-none mt-0.5">
                  💬
                </span>
                <div className="min-w-0">
                  <h2 id="ai-help-title" className="text-lg sm:text-xl font-semibold text-anthracite tracking-tight">
                    {t('aiHelp.title')}
                  </h2>
                  <p className="mt-1.5 text-[15px] text-anthracite-light leading-relaxed max-w-2xl">{t('aiHelp.body')}</p>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Back to top (a sinistra per non collidere col chat launcher) */}
        {showBackTop && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label={t('nav.backToTop')}
            className="fixed bottom-6 left-6 z-40 w-11 h-11 rounded-full bg-anthracite text-white hover:bg-teal-dark transition-colors flex items-center justify-center"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </main>
      <Footer />
      <GuideChatWidget />
    </>
  )
}
