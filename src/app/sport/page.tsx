import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Modulo Sport | Stress Index — DFA Alpha1 Real-Time per Professionisti',
  description:
    'DFA Alpha1 in tempo reale, zone metaboliche, rischio infortuni, questionario post-allenamento. Il modulo sport professionale per preparatori atletici e fisioterapisti.',
  alternates: { canonical: 'https://stressindex.io/sport' },
  openGraph: {
    title: 'Modulo Sport | Stress Index — DFA Alpha1 Real-Time per Professionisti',
    description:
      'DFA Alpha1 in tempo reale, zone metaboliche, rischio infortuni, questionario post-allenamento. Il modulo sport professionale per preparatori atletici e fisioterapisti.',
    url: 'https://stressindex.io/sport',
    siteName: 'Stress Index',
    locale: 'it_IT',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Modulo Sport | Stress Index — DFA Alpha1 Real-Time per Professionisti',
    description:
      'DFA Alpha1 in tempo reale, zone metaboliche, rischio infortuni, questionario post-allenamento.',
  },
}

const ZONES = [
  {
    emoji: '🟢',
    range: '> 0.75',
    title: 'Zona aerobica pura',
    body: 'Recupero attivo, fondo lungo, sviluppo della base aerobica.',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
  },
  {
    emoji: '🟡',
    range: '0.50 - 0.75',
    title: 'Transizione (VT1 superato)',
    body: 'Soglia aerobica oltrepassata. Carico moderato sostenibile.',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
  },
  {
    emoji: '🟠',
    range: '0.30 - 0.50',
    title: 'Zona anaerobica (VT2 superato)',
    body: 'Soglia anaerobica oltrepassata. Sforzo intenso, durata limitata.',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
  },
  {
    emoji: '🔴',
    range: '< 0.30',
    title: 'Carico massimale',
    body: 'Massima intensità. Sostenibile solo per pochi minuti.',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
  },
]

const LIVE_FEATURES = [
  { icon: '❤️', text: 'HR live con grafico scorrevole' },
  { icon: '📉', text: 'RMSSD rolling per monitorare il recupero' },
  { icon: '🎯', text: 'DFA Alpha1 con le 4 zone colorate' },
  { icon: '🏷️', text: 'Tag durante l\'attività (inizio sprint, cambio ritmo, pausa, fine warm-up)' },
  { icon: '⚡', text: 'TRIMP calcolato automaticamente a fine sessione' },
]

const POST_QUESTIONS = [
  { icon: '💪', text: 'RPE scala Borg (1-10)' },
  { icon: '🔋', text: 'Livello energia' },
  { icon: '😊', text: 'Umore' },
  { icon: '🩹', text: 'Mappa dolore muscolare interattiva (12 zone)' },
  { icon: '📝', text: 'Note libere' },
]

const ROADMAP = [
  'Alert rischio infortuni (ACWR + HRV)',
  'Performance Management Chart (CTL, ATL, TSB)',
  'Team Dashboard multi-atleta',
  'Rilevamento automatico soglie VT1/VT2',
  'AI interpretation dei trend',
  'Questionario wellness giornaliero',
]

const COMPETITIVE_ROWS: Array<{
  feature: string
  kubios: string
  hrv4: string
  us: string
  highlight?: boolean
}> = [
  { feature: 'DFA Alpha1 real-time', kubios: 'Solo desktop', hrv4: 'No', us: '✅ Mobile' },
  { feature: 'Zone metaboliche live', kubios: 'No', hrv4: 'No', us: '✅ 4 zone' },
  { feature: 'Mappa dolore muscolare', kubios: 'No', hrv4: 'No', us: '✅ 12 zone' },
  { feature: 'Report PDF sport', kubios: 'Desktop, 750€/anno', hrv4: 'No', us: '✅ Incluso' },
  { feature: 'Italiano + GDPR EU', kubios: 'No', hrv4: 'No', us: '✅' },
  { feature: 'Prezzo', kubios: '750€/anno', hrv4: '10€/mese consumer', us: '69€/mese Pro', highlight: true },
]

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

export default function SportPage() {
  return (
    <main className="bg-white text-anthracite">
      <Header />

      <div className="pt-16">
        {/* HERO — sfondo scuro anthracite */}
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
              <span>Modulo Sport · Piano Pro</span>
            </div>
            <h1 className="mt-5 font-serif text-[40px] md:text-[60px] leading-[1.05] tracking-tight max-w-4xl">
              Porta il laboratorio <em className="italic text-teal">in campo.</em>
            </h1>
            <p className="mt-6 text-[18px] md:text-xl text-white/80 leading-relaxed max-w-2xl">
              DFA Alpha1 in tempo reale, zone metaboliche live, rischio infortuni. Tutto dal tuo
              telefono, durante l&apos;allenamento.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/registrazione"
                className="inline-flex items-center justify-center px-6 py-3.5 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark transition-colors"
              >
                Attiva il Piano Pro
                <span className="ml-2" aria-hidden="true">→</span>
              </Link>
              <a
                href="#dfa"
                className="inline-flex items-center px-2 py-3 text-white/90 font-medium hover:text-teal-light transition-colors"
              >
                Vedi come funziona
                <span className="ml-1" aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="mt-5 text-sm text-white/60">
              69€/mese · Include tutte le funzionalità base · Disdici quando vuoi
            </p>
          </div>
        </section>

        {/* IL GAP */}
        <section className="py-16 md:py-24 px-6 border-b border-gray-100">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
              <span aria-hidden="true">⏳</span>
              <span>Il gap</span>
            </div>
            <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
              I tuoi atleti si allenano ogni giorno. <em className="italic text-teal">Tu li valuti una volta ogni tanto.</em>
            </h2>
            <div className="mt-6 space-y-4 text-[17px] text-anthracite-light leading-relaxed">
              <p>Nel mezzo, non hai dati.</p>
              <p>Non sai se stanno recuperando.</p>
              <p>Non sai se il carico è troppo.</p>
              <p>Non sai se domani si infortunano.</p>
            </div>
            <div className="mt-8 rounded-xl border-l-4 border-teal bg-teal-light/50 px-5 py-4">
              <p className="text-[16px] font-medium text-anthracite leading-relaxed">
                Stress Index Sport cambia tutto.
              </p>
            </div>
          </div>
        </section>

        {/* DFA ALPHA1 REAL-TIME */}
        <section id="dfa" className="py-16 md:py-24 px-6 border-b border-gray-100 scroll-mt-20">
          <div className="max-w-5xl mx-auto">
            <SectionHeader
              eyebrow="DFA Alpha1 real-time"
              emoji="🎯"
              title={
                <>
                  Le zone metaboliche. <em className="italic text-teal">Senza laboratorio.</em>
                </>
              }
              description="L'unico parametro che ti dice in tempo reale in quale zona metabolica si trova il tuo atleta. Senza test di laboratorio. Senza CPET. Solo una fascia toracica e il telefono."
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
                {ZONES.map((z) => (
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
              Aggiornato ogni 5 secondi. Calcolato in un processore dedicato. Precisione clinica.
            </p>
          </div>
        </section>

        {/* SESSIONE LIVE */}
        <section className="py-16 md:py-24 px-6 border-b border-gray-100">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-start">
            <div>
              <SectionHeader
                eyebrow="Sessione live"
                emoji="📊"
                title={
                  <>
                    Avvia una sessione. <em className="italic text-teal">Vedi tutto in tempo reale.</em>
                  </>
                }
                description="Avvia una sessione sport, colleghi la fascia, e vedi tutto in tempo reale:"
              />
              <ul className="mt-8 space-y-4">
                {LIVE_FEATURES.map((f) => (
                  <li key={f.text} className="flex gap-3 items-start">
                    <span className="text-xl flex-shrink-0" aria-hidden="true">{f.icon}</span>
                    <span className="text-[15.5px] text-anthracite leading-relaxed">{f.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="rounded-2xl bg-anthracite p-5 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                    </span>
                    <span className="text-[13px] font-medium">Sessione · LIVE</span>
                  </div>
                  <span className="text-[12px] font-mono text-white/60">42:18</span>
                </div>

                <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-white/60">DFA Alpha1</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold tabular-nums text-emerald-400">0.82</span>
                    <span className="text-sm text-white/60">Zona aerobica</span>
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
                    <div className="text-[11px] text-white/50">ms · rolling 60s</div>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/60">Tag sessione</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {['Warm-up 12\'', 'Sprint #1', 'Recupero', 'Sprint #2'].map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-teal/30 border border-teal/50 text-[11px] font-medium">
                        {t}
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
              eyebrow="Questionario post-allenamento"
              emoji="🏋️"
              title={
                <>
                  Soggettivo + oggettivo. <em className="italic text-teal">Il quadro completo.</em>
                </>
              }
              description="Alla fine di ogni sessione, l'app guida il tuo atleta in un questionario rapido:"
            />

            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {POST_QUESTIONS.map((q) => (
                <div key={q.text} className="rounded-xl border border-gray-200 bg-white p-5 flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0" aria-hidden="true">{q.icon}</span>
                  <span className="text-[15px] text-anthracite leading-relaxed">{q.text}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-xl border-l-4 border-teal bg-teal-light/50 px-5 py-4">
              <p className="text-[15.5px] text-anthracite leading-relaxed">
                <span className="font-semibold">Dati soggettivi + dati oggettivi HRV</span> = il quadro completo.
              </p>
            </div>
          </div>
        </section>

        {/* DASHBOARD ATLETA 60 GIORNI */}
        <section className="py-16 md:py-24 px-6 border-b border-gray-100">
          <div className="max-w-5xl mx-auto">
            <SectionHeader
              eyebrow="Dashboard atleta · 60 giorni"
              emoji="📈"
              title={
                <>
                  ln(RMSSD) con baseline individuale. <em className="italic text-teal">Metodo Plews.</em>
                </>
              }
              description="Trend ln(RMSSD) con baseline individuale e banda di normalità (metodo Plews). Vedi a colpo d'occhio se il tuo atleta è in forma, in sovrallenamento, o a rischio."
            />

            <div className="mt-10 grid md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" aria-hidden="true" />
                  <h3 className="font-semibold text-anthracite text-[15px]">Sopra la banda</h3>
                </div>
                <p className="mt-2 text-[14px] text-anthracite-light leading-relaxed">
                  Recuperato. Pronto per un carico maggiore.
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" aria-hidden="true" />
                  <h3 className="font-semibold text-anthracite text-[15px]">Dentro la banda</h3>
                </div>
                <p className="mt-2 text-[14px] text-anthracite-light leading-relaxed">
                  Normale. Carico programmato senza modifiche.
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500" aria-hidden="true" />
                  <h3 className="font-semibold text-anthracite text-[15px]">Sotto la banda</h3>
                </div>
                <p className="mt-2 text-[14px] text-anthracite-light leading-relaxed">
                  Attenzione. Considera riduzione del carico.
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-anthracite text-[15px]">ln(RMSSD) ultimi 60 giorni</h3>
                <span className="text-[12px] text-anthracite-lighter font-mono">baseline 4.05 ± 0.30</span>
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
                Banda di normalità in teal. Punti verdi = recupero, rossi = attenzione.
              </p>
            </div>

            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              {[
                { label: 'TRIMP settimanale', value: '412' },
                { label: 'RPE medio', value: '6.2' },
                { label: 'Sessioni', value: '14' },
              ].map((s) => (
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
              eyebrow="Confronto"
              emoji="🆚"
              title={
                <>
                  Perché Stress Index Sport. <em className="italic text-teal">In una tabella.</em>
                </>
              }
            />

            <div className="mt-10 rounded-2xl border border-gray-200 bg-white overflow-x-auto">
              <table className="w-full text-[14.5px] min-w-[640px]">
                <thead className="bg-surface text-anthracite-lighter text-[12px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-4 font-medium">Funzionalità</th>
                    <th className="text-left px-5 py-4 font-medium">Kubios</th>
                    <th className="text-left px-5 py-4 font-medium">HRV4Training</th>
                    <th className="text-left px-5 py-4 font-medium bg-teal-light/40 text-teal-dark">
                      Stress Index
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {COMPETITIVE_ROWS.map((row) => (
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
              eyebrow="Roadmap · Fase 2-3"
              emoji="🔮"
              title={
                <>
                  In arrivo. <em className="italic text-teal">Per chi è dentro adesso.</em>
                </>
              }
              description="Il Modulo Sport è solo l'inizio. Ecco cosa arriva nei prossimi mesi:"
            />

            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ROADMAP.map((r) => (
                <div key={r} className="rounded-xl border border-gray-200 bg-white px-5 py-4 flex items-start gap-3">
                  <span className="text-teal font-semibold mt-0.5 flex-shrink-0" aria-hidden="true">›</span>
                  <span className="text-[15px] text-anthracite leading-snug">{r}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-xl border-l-4 border-teal bg-teal-light/50 px-5 py-4">
              <p className="text-[15.5px] text-anthracite leading-relaxed">
                <span aria-hidden="true">⭐</span> I professionisti che si attivano ora avranno
                accesso anticipato a tutte le nuove funzionalità.
              </p>
            </div>
          </div>
        </section>

        {/* CTA FINALE — sfondo teal */}
        <section className="py-20 md:py-28 px-6 bg-teal text-white">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-[13px] font-medium text-white/90 uppercase tracking-wider">
              <span aria-hidden="true">🚀</span>
              <span>Attiva il Piano Pro</span>
            </div>
            <h2 className="mt-4 font-serif text-3xl md:text-5xl leading-tight tracking-tight">
              Porta il laboratorio in campo. <em className="italic text-teal-light">Attiva il Piano Pro.</em>
            </h2>
            <p className="mt-5 text-[18px] text-white/85 leading-relaxed">
              69€/mese · 60 giorni di prova · Disdici quando vuoi
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/registrazione"
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-teal-dark font-semibold rounded-lg hover:bg-teal-light transition-colors text-[16px]"
              >
                Attiva il Piano Pro
                <span className="ml-2" aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="mt-5 text-sm text-white/70">
              Include tutte le funzionalità del Piano Base (49,90€/mese) + Modulo Sport completo
            </p>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  )
}
