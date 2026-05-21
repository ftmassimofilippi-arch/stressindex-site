import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Funzionalità | Stress Index — Analisi HRV Completa',
  description:
    '5 score proprietari, 25+ parametri HRV, 3 tipi di test, sessioni lunghe, report PDF, CRM clienti, dashboard web. Scopri tutte le funzionalità.',
  alternates: { canonical: 'https://stressindex.io/funzionalita' },
  openGraph: {
    title: 'Funzionalità | Stress Index — Analisi HRV Completa',
    description:
      '5 score proprietari, 25+ parametri HRV, 3 tipi di test, sessioni lunghe, report PDF, CRM clienti, dashboard web. Scopri tutte le funzionalità.',
    url: 'https://stressindex.io/funzionalita',
    siteName: 'Stress Index',
    locale: 'it_IT',
    type: 'website',
    images: [{ url: 'https://stressindex.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Funzionalità | Stress Index — Analisi HRV Completa',
    description:
      '5 score proprietari, 25+ parametri HRV, 3 tipi di test, sessioni lunghe, report PDF, CRM clienti, dashboard web.',
    images: ['https://stressindex.io/og-image.png'],
  },
}

const SCORES = [
  {
    emoji: '🔴',
    name: 'Indice di Stress',
    range: '0-100',
    accent: '#E85D4A',
    description:
      'Quanto il sistema nervoso è sotto pressione. Basato su 5 parametri pesati: Stress Index Baevsky, SDNN, Total Power, DFA Alpha1, HF norm.',
  },
  {
    emoji: '🟢',
    name: 'Recupero',
    range: '0-100',
    accent: '#10B981',
    description:
      'La capacità del parasimpatico di rigenerare. Se è basso cronicamente, il cliente non recupera tra una sessione e l\'altra.',
  },
  {
    emoji: '🔵',
    name: 'Equilibrio',
    range: '0-100',
    accent: '#3B82F6',
    description:
      'Il bilanciamento simpatico-parasimpatico. Non è più alto = meglio. Il valore ottimale è al centro.',
  },
  {
    emoji: '🟠',
    name: 'Energia',
    range: '0-100',
    accent: '#F59E0B',
    description:
      'Le risorse energetiche complessive del sistema nervoso. Basato sulla potenza totale dello spettro.',
  },
  {
    emoji: '🟣',
    name: 'Modulazione Infiammatoria',
    range: '0-100',
    accent: '#A855F7',
    description:
      'La capacità del nervo vago di modulare l\'infiammazione. Basato sul riflesso antinfiammatorio colinergico (Tracey 2002). Unico nel mercato.',
  },
]

const HRV_GROUPS = [
  {
    title: 'Time Domain',
    emoji: '⏱️',
    items: ['RMSSD', 'SDNN', 'Mean HR', 'pNN50', 'pNN20', 'HRV-CV', 'RMSSD/SDNN'],
  },
  {
    title: 'Frequency Domain',
    emoji: '📡',
    note: 'FFT Welch + Lomb-Scargle',
    items: ['LF Power', 'HF Power', 'VLF Power', 'Total Power', 'LF/HF', 'LF norm', 'HF norm'],
  },
  {
    title: 'Non-linear',
    emoji: '🌀',
    items: ['DFA Alpha1', 'DFA Alpha2', 'SD1', 'SD2', 'SD1/SD2', 'Sample Entropy', 'Approximate Entropy'],
  },
  {
    title: 'Geometric',
    emoji: '📐',
    items: ['Stress Index Baevsky', 'Triangular Index', 'TINN'],
  },
]

const TESTS = [
  {
    emoji: '📷',
    title: 'Misurazione Standard',
    body:
      'La fotografia dello stato attuale. 5 o 10 minuti, seduto o supino. Il 70% delle valutazioni le farai con questa.',
  },
  {
    emoji: '🧍',
    title: 'Test Ortostatico',
    body:
      'Misura la reattività del sistema nervoso. 5 minuti supino, poi 5 minuti in piedi. L\'app ti guida con suono e vibrazione alla transizione. Perfetto per disautonomie, long COVID, atleti sovrallenati.',
  },
  {
    emoji: '🌬️',
    title: 'Respirazione di Coerenza',
    body:
      'Guida visiva animata per il respiro. Trova la frequenza di risonanza personale del tuo cliente. Score di coerenza in tempo reale. Ideale per ansia, insonnia, dolore cronico.',
  },
  {
    emoji: '⏳',
    title: 'Sessioni Lunghe',
    badge: 'NUOVO',
    body:
      'Durata libera per misurare durante i trattamenti. Tag in tempo reale, analisi ogni 2 minuti, confronto automatico prima/dopo il trattamento. Dimostra ai tuoi clienti che il trattamento funziona, con i dati.',
  },
]

const CRM_FEATURES = [
  'Anagrafica estesa (sesso, età, fumatore, atleta)',
  'Storico misurazioni con trend',
  'Confronto fino a 29 parametri tra sessioni',
  'Note libere per cliente',
  'Tag misurazioni per categorizzare',
]

const PRIVACY_ITEMS = [
  { icon: '🇪🇺', title: 'Server in Europa', body: 'Datacenter a Francoforte, Germania.' },
  { icon: '📜', title: 'GDPR compliant', body: 'Consenso registrato per ogni cliente.' },
  { icon: '🔐', title: 'Crittografia', body: 'Dati in transito e a riposo cifrati.' },
  { icon: '🚫', title: 'Nessuna condivisione', body: 'I dati non escono dall\'Europa. Mai.' },
]

const SENSORS: { status: 'ok' | 'limit' | 'no'; name: string; note: string }[] = [
  { status: 'ok', name: 'Polar H10 (90€)', note: 'Il nostro standard, ECG, precisione massima. Consigliato.' },
  { status: 'ok', name: 'Polar H9 (50€)', note: 'Stessa qualità ECG del H10, ottimo rapporto qualità prezzo.' },
  { status: 'ok', name: 'Polar OH1 / Verity Sense', note: 'Sensore ottico da braccio, funziona ma meno preciso di una fascia ECG.' },
  { status: 'limit', name: 'Wahoo TICKR', note: 'Funziona, buona stabilità BLE. Da testare con la propria unità.' },
  { status: 'limit', name: 'CooSpo H808S', note: 'Funziona, economico (30€), qualità inferiore al Polar.' },
  { status: 'no', name: 'Whoop 4.0', note: 'Trasmette solo BPM, non gli intervalli RR necessari per l\'analisi HRV.' },
  { status: 'no', name: 'Fasce Garmin (HRM-Dual, HRM-Pro)', note: 'Non trasmettono RR intervals via BLE standard.' },
  { status: 'no', name: 'Apple Watch', note: 'Non trasmette dati ECG via BLE.' },
]

function SensorBadge({ s }: { s: 'ok' | 'limit' | 'no' }) {
  if (s === 'ok')
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium text-[13.5px]">
        <span aria-hidden="true">✅</span> Compatibile
      </span>
    )
  if (s === 'limit')
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium text-[13.5px]">
        <span aria-hidden="true">⚠️</span> Con limiti
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 text-rose-700 font-medium text-[13.5px]">
      <span aria-hidden="true">❌</span> Non compatibile
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

export default function FunzionalitaPage() {
  return (
    <main className="bg-white text-anthracite">
      <Header />

      <div className="pt-16">
        {/* HERO */}
        <section className="pt-16 md:pt-24 pb-12 md:pb-16 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 text-[13px] font-medium text-teal-dark">
              <span aria-hidden="true">✨</span>
              <span>Tutte le funzionalità di Stress Index</span>
            </div>
            <h1 className="mt-4 font-serif text-[36px] md:text-[52px] leading-[1.08] tracking-tight text-anthracite max-w-4xl">
              Tutto quello che ti serve per misurare lo stress.{' '}
              <em className="italic text-teal">In un&apos;unica app.</em>
            </h1>
            <p className="mt-5 text-[17px] md:text-lg text-anthracite-light leading-relaxed max-w-2xl">
              Stress Index è il software HRV professionale più completo sul mercato italiano.
              Ecco cosa puoi fare.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href="/registrazione"
                className="inline-flex items-center justify-center px-6 py-3 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark transition-colors"
              >
                Prova gratis 60 giorni
                <span className="ml-2" aria-hidden="true">→</span>
              </Link>
              <a
                href="#score"
                className="inline-flex items-center px-2 py-3 text-anthracite font-medium hover:text-teal transition-colors"
              >
                Scopri come funziona
                <span className="ml-1" aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
        </section>

        {/* SEZIONE 1 — 5 SCORE PROPRIETARI */}
        <section id="score" className="py-16 md:py-24 px-6 border-t border-gray-100 scroll-mt-20">
          <div className="max-w-5xl mx-auto">
            <SectionHeader
              eyebrow="Score proprietari"
              emoji="📊"
              title={
                <>
                  5 numeri. <em className="italic text-teal">Tutto chiaro a colpo d&apos;occhio.</em>
                </>
              }
              description="Non devi essere un esperto di HRV per usare Stress Index. I 5 score proprietari ti danno una fotografia immediata del tuo cliente: quanto è stressato, come recupera, se il sistema nervoso è in equilibrio, quanta energia ha, e come gestisce l'infiammazione."
            />

            <div className="mt-12 grid md:grid-cols-2 gap-5">
              {SCORES.map((s) => (
                <div
                  key={s.name}
                  className="rounded-xl border border-gray-200 bg-white p-6"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">{s.emoji}</span>
                    <h3 className="text-lg font-semibold text-anthracite tracking-tight">{s.name}</h3>
                    <span className="text-xs text-anthracite-lighter font-mono tabular-nums ml-auto">{s.range}</span>
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

        {/* SEZIONE 2 — 25+ PARAMETRI HRV */}
        <section className="py-16 md:py-24 px-6 border-t border-gray-100">
          <div className="max-w-5xl mx-auto">
            <SectionHeader
              eyebrow="Parametri scientifici"
              emoji="🔬"
              title={
                <>
                  25+ parametri HRV. <em className="italic text-teal">Tutta la letteratura, sempre con te.</em>
                </>
              }
              description="Per il professionista che vuole andare in profondità, Stress Index calcola tutti i parametri validati dalla letteratura scientifica."
            />

            <div className="mt-12 grid md:grid-cols-2 gap-5">
              {HRV_GROUPS.map((g) => (
                <div key={g.title} className="rounded-xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">{g.emoji}</span>
                    <h3 className="text-lg font-semibold text-anthracite tracking-tight">{g.title}</h3>
                  </div>
                  {g.note ? (
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
                <span className="font-medium">💡 Range normativi automatici.</span> Ogni parametro
                ha un semaforo colorato basato sui range normativi per età e sesso del cliente
                (Nunan 2010, Voss 2015). Non devi ricordare i valori di riferimento, l&apos;app lo fa per te.
              </Callout>
            </div>
          </div>
        </section>

        {/* SEZIONE 3 — 3 TIPI DI TEST */}
        <section className="py-16 md:py-24 px-6 border-t border-gray-100">
          <div className="max-w-5xl mx-auto">
            <SectionHeader
              eyebrow="Tipi di test"
              emoji="🩺"
              title={
                <>
                  Un test per ogni esigenza. <em className="italic text-teal">Dal protocollo standard alla seduta lunga.</em>
                </>
              }
              description="Quattro modalità di misurazione pensate per coprire il 100% dei casi clinici e di campo."
            />

            <div className="mt-12 grid md:grid-cols-2 gap-5">
              {TESTS.map((t) => (
                <div key={t.title} className="rounded-xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">{t.emoji}</span>
                    <h3 className="text-lg font-semibold text-anthracite tracking-tight">{t.title}</h3>
                    {t.badge ? (
                      <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-teal text-white text-[11px] font-medium uppercase tracking-wider">
                        {t.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-[15px] text-anthracite-light leading-relaxed">{t.body}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-[14.5px] text-anthracite-lighter">
              Lavori con atleti? Esiste un modulo dedicato con DFA Alpha1 real-time e zone metaboliche live.{' '}
              <Link href="/sport" className="text-teal-dark font-medium hover:text-teal hover:underline">
                Scopri il Modulo Sport →
              </Link>
            </p>
          </div>
        </section>

        {/* SEZIONE 4 — REPORT PDF */}
        <section className="py-16 md:py-24 px-6 border-t border-gray-100">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <SectionHeader
                eyebrow="Report PDF"
                emoji="📋"
                title={
                  <>
                    Un PDF clinico. <em className="italic text-teal">Pronto in seduta.</em>
                  </>
                }
              />
              <p className="mt-5 text-[17px] text-anthracite-light leading-relaxed">
                Un PDF di 4 pagine che puoi stampare, inviare per email o mostrare al cliente in seduta.
                Include tutti gli score, i parametri dettagliati, i grafici clinici (Poincaré, ritmogramma,
                spettro PSD) e il disclaimer medico. Personalizzabile con il tuo nome, titolo e studio.
              </p>
              <ul className="mt-6 space-y-3 text-[15px] text-anthracite-light">
                {[
                  'Header personalizzato con nome, titolo e studio',
                  '5 score proprietari con grafico a barre colorato',
                  '25+ parametri HRV con range normativi e semaforo',
                  'Grafici clinici: Poincaré, ritmogramma RR, spettro PSD',
                  'Disclaimer medico e generazione tracciata',
                ].map((it) => (
                  <li key={it} className="flex gap-2.5">
                    <span className="text-teal font-semibold mt-0.5" aria-hidden="true">✓</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="rounded-2xl bg-white border border-gray-200 p-6">
                <div className="rounded-lg border border-gray-100 bg-surface aspect-[3/4] p-5 flex flex-col">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-teal" />
                      <span className="text-[11px] font-semibold text-anthracite">Stress Index</span>
                    </div>
                    <span className="text-[10px] text-anthracite-lighter">Report cliente</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-2 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {SCORES.slice(0, 4).map((s) => (
                      <div key={s.name} className="rounded bg-white border border-gray-200 p-2">
                        <div className="text-[9px] uppercase text-anthracite-lighter tracking-wider">
                          {s.name}
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: '64%', backgroundColor: s.accent }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto pt-4 text-[10px] text-anthracite-lighter">
                    Pagina 1 di 4 · Generato da Stress Index
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEZIONE 5 — CRM */}
        <section className="py-16 md:py-24 px-6 border-t border-gray-100">
          <div className="max-w-5xl mx-auto">
            <SectionHeader
              eyebrow="CRM Clienti"
              emoji="👥"
              title={
                <>
                  I tuoi clienti, organizzati. <em className="italic text-teal">In un solo posto.</em>
                </>
              }
              description="Gestisci tutti i tuoi clienti in un unico posto. Anagrafica completa, storico misurazioni, confronto sessioni, note cliniche. Tutto sincronizzato tra app e dashboard web."
            />

            <div className="mt-10 grid md:grid-cols-2 gap-5">
              {CRM_FEATURES.map((f) => (
                <div key={f} className="rounded-xl border border-gray-200 bg-white px-5 py-4 flex items-start gap-3">
                  <span className="text-teal font-semibold mt-0.5" aria-hidden="true">✓</span>
                  <span className="text-[15px] text-anthracite">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SEZIONE 6 — DASHBOARD WEB */}
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
                    {[
                      { l: 'Stress', v: 72, c: '#E85D4A' },
                      { l: 'Recupero', v: 68, c: '#10B981' },
                      { l: 'Equilibrio', v: 55, c: '#3B82F6' },
                      { l: 'Energia', v: 63, c: '#F59E0B' },
                    ].map((s) => (
                      <div key={s.l} className="rounded-md bg-white border border-gray-200 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-anthracite-lighter">{s.l}</div>
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
                      <div className="text-[10px] uppercase tracking-wider text-anthracite-lighter">Trend ultimi 30 giorni</div>
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
                eyebrow="Dashboard Web"
                emoji="🌐"
                title={
                  <>
                    Non solo app. <em className="italic text-teal">Anche dal computer.</em>
                  </>
                }
              />
              <p className="mt-5 text-[17px] text-anthracite-light leading-relaxed">
                Non solo app. Accedi ai dati dei tuoi clienti anche dal computer su stressindex.io.
                Grafici interattivi, trend nel tempo, alert automatici, report periodici PDF.
                Perfetto quando sei in studio davanti al PC.
              </p>
              <ul className="mt-6 space-y-3 text-[15px] text-anthracite-light">
                {[
                  'Grafici interattivi con doppio asse Y',
                  'Trend di 30 / 60 / 90 giorni',
                  'Alert automatici su stress e recupero',
                  'Report periodici PDF con commento automatico',
                  'CRM completo accessibile da browser',
                ].map((it) => (
                  <li key={it} className="flex gap-2.5">
                    <span className="text-teal font-semibold mt-0.5" aria-hidden="true">✓</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* SEZIONE 7 — SICUREZZA & PRIVACY */}
        <section className="py-16 md:py-24 px-6 border-t border-gray-100">
          <div className="max-w-5xl mx-auto">
            <SectionHeader
              eyebrow="Sicurezza e Privacy"
              emoji="🔒"
              title={
                <>
                  Privacy garantita. <em className="italic text-teal">Per legge.</em>
                </>
              }
              description="I dati sanitari dei tuoi clienti sono protetti dalla normativa europea più rigorosa. Niente tracking nascosto, niente terze parti, nessuna sorpresa."
            />

            <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {PRIVACY_ITEMS.map((p) => (
                <div key={p.title} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="text-2xl" aria-hidden="true">{p.icon}</div>
                  <h3 className="mt-3 font-semibold text-anthracite">{p.title}</h3>
                  <p className="mt-1.5 text-[14px] text-anthracite-light leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SEZIONE 8 — SENSORI */}
        <section className="py-16 md:py-24 px-6 border-t border-gray-100">
          <div className="max-w-5xl mx-auto">
            <SectionHeader
              eyebrow="Sensori"
              emoji="📡"
              title={
                <>
                  Funziona con la tua fascia. <em className="italic text-teal">O con quella che consigliamo.</em>
                </>
              }
              description="Nessun hardware proprietario. Stress Index si connette via Bluetooth con i principali sensori HR del mercato."
            />

            <div className="mt-10">
              <Callout>
                <span className="font-medium">💡 La nostra scelta.</span> Consigliamo Polar H10: ECG,
                precisione al millisecondo. È quello che usiamo internamente per ogni test e validazione.
                Per la configurazione passo-passo, vedi le{' '}
                <Link href="/guide" className="text-teal-dark font-medium hover:underline">
                  guide al sensore
                </Link>
                .
              </Callout>
            </div>

            <div className="mt-8 rounded-xl border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-[14.5px]">
                <thead className="bg-surface text-anthracite-lighter text-[12px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Sensore</th>
                    <th className="text-left px-5 py-3 font-medium">Stato</th>
                    <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {SENSORS.map((s) => (
                    <tr key={s.name} className="hover:bg-surface/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-anthracite">{s.name}</td>
                      <td className="px-5 py-3">
                        <SensorBadge s={s.status} />
                      </td>
                      <td className="px-5 py-3 text-anthracite-light hidden sm:table-cell">{s.note}</td>
                    </tr>
                  ))}
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
                <span>Inizia oggi</span>
              </div>
              <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
                Prova Stress Index gratis <em className="italic text-teal">per 60 giorni.</em>
              </h2>
              <p className="mt-4 text-[17px] text-anthracite-light leading-relaxed">
                Tutte le funzionalità. Nessun vincolo. Disdici quando vuoi.
              </p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/registrazione"
                  className="inline-flex items-center justify-center px-6 py-3 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark transition-colors"
                >
                  Inizia la prova gratuita
                  <span className="ml-2" aria-hidden="true">→</span>
                </Link>
              </div>
              <p className="mt-4 text-sm text-anthracite-lighter">
                Carta di credito richiesta · Nessun addebito per 60 giorni · Disdici quando vuoi
              </p>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  )
}
