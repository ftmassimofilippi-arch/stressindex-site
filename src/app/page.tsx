import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Stress Index | Software HRV Professionale per Fisioterapisti e Osteopati',
  description:
    'Misura lo stress dei tuoi clienti in 10 minuti. Software HRV professionale per fisioterapisti, osteopati e medici sportivi. 4 indici clinici, report PDF, 15 giorni gratis.',
  openGraph: {
    title: 'Stress Index | Software HRV Professionale per Fisioterapisti e Osteopati',
    description:
      'Misura lo stress dei tuoi clienti in 10 minuti. 4 indici clinici, report PDF, 15 giorni gratis.',
    url: 'https://stressindex.io',
    siteName: 'Stress Index',
    locale: 'it_IT',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stress Index | Software HRV Professionale per Fisioterapisti e Osteopati',
    description:
      'Misura lo stress dei tuoi clienti in 10 minuti. 4 indici clinici, report PDF, 15 giorni gratis.',
  },
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 group" aria-label="Stress Index — Home">
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
        Stress Index
      </span>
    </Link>
  )
}

function Navbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-1 text-[14px] text-anthracite-light">
          <a href="#come-funziona" className="px-3 py-2 rounded-md hover:text-teal transition-colors">
            Come funziona
          </a>
          <a href="#benefici" className="px-3 py-2 rounded-md hover:text-teal transition-colors">
            Funzionalità
          </a>
          <a href="#prezzi" className="px-3 py-2 rounded-md hover:text-teal transition-colors">
            Prezzi
          </a>
          <a href="#faq" className="px-3 py-2 rounded-md hover:text-teal transition-colors">
            FAQ
          </a>
          <Link href="/guide" className="px-3 py-2 rounded-md hover:text-teal transition-colors">
            Guide
          </Link>
          <Link href="/area-professionisti/login" className="px-3 py-2 rounded-md hover:text-teal transition-colors">
            Area Professionisti
          </Link>
        </nav>
        <Link
          href="/registrazione"
          className="inline-flex items-center justify-center px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-dark transition-colors"
        >
          Inizia gratis
        </Link>
      </div>
    </header>
  )
}

function HeroMockup() {
  const scores = [
    { label: 'Stress', value: 72, barClass: 'bg-[#E85D4A]' },
    { label: 'Recupero', value: 68, barClass: 'bg-teal' },
    { label: 'Equilibrio', value: 55, barClass: 'bg-[#F59E0B]' },
    { label: 'Energia', value: 63, barClass: 'bg-[#6366F1]' },
  ]
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="rounded-2xl bg-white border border-gray-200 p-4">
        <div className="rounded-xl bg-surface overflow-hidden border border-gray-100">
          <div className="bg-teal text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white/80" />
              <span className="text-[13px] font-medium tracking-tight">Stress Index · Misura in corso</span>
            </div>
            <span className="text-[12px] font-mono opacity-80">08:32</span>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            {scores.map((s) => (
              <div key={s.label} className="bg-white rounded-lg p-3.5 border border-gray-200">
                <div className="text-[11px] uppercase tracking-wider text-anthracite-lighter font-medium">{s.label}</div>
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
            <span className="text-[12px] text-anthracite-lighter tabular-nums">65 bpm · ECG live</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="pt-32 md:pt-36 pb-16 md:pb-20 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-teal-dark">
            <span aria-hidden="true">🩺</span>
            <span>Software HRV per professionisti del benessere</span>
          </div>
          <h1 className="mt-4 font-serif text-[36px] md:text-[52px] leading-[1.08] tracking-tight text-anthracite">
            Il tuo cliente è stressato.{' '}
            <em className="italic text-teal">Adesso puoi dimostrarlo.</em>
          </h1>
          <p className="mt-5 text-[17px] md:text-lg text-anthracite-light leading-relaxed max-w-xl">
            Stress Index misura il sistema nervoso autonomo in 10 minuti e ti consegna 4 indici clinici
            pronti da usare in seduta. Basta valutazioni a occhio. Basta spiegare senza dati.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link
              href="/registrazione"
              className="inline-flex items-center justify-center px-6 py-3 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark transition-colors"
            >
              Prova gratis 15 giorni
              <span className="ml-2" aria-hidden="true">→</span>
            </Link>
            <a
              href="#come-funziona"
              className="inline-flex items-center px-2 py-3 text-anthracite font-medium hover:text-teal transition-colors"
            >
              Guarda come funziona
              <span className="ml-1" aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="mt-4 text-sm text-anthracite-lighter">
            Carta di credito richiesta · Nessun addebito per 15 giorni · Disdici quando vuoi
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
  const items = [
    { icon: '🔬', text: '24 parametri HRV' },
    { icon: '📱', text: 'Android e iOS' },
    { icon: '🇪🇺', text: 'Server EU · GDPR' },
    { icon: '📄', text: 'Report PDF clinico' },
    { icon: '🩺', text: 'Per professionisti della salute' },
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
  const cards = [
    {
      icon: '🎯',
      title: 'Valuto tutto clinicamente',
      body:
        "Funziona. Finché il cliente non ti chiede perché non migliora, o finché un collega non gli porta un report con i dati. L'impressione clinica non si difende, i numeri sì.",
    },
    {
      icon: '⏳',
      title: 'Gli strumenti HRV esistono già',
      body:
        'Sì, esistono. Sono pensati per ricercatori, costano migliaia di euro, producono report incomprensibili e richiedono settimane di formazione. Non sono stati costruiti per il tuo studio.',
    },
    {
      icon: '🔁',
      title: 'Faccio vedere i miglioramenti al cliente',
      body:
        'Come? A parole? Il cliente vuole vedere il suo grafico che migliora nel tempo. Vuole il PDF da mostrare al medico. Vuole capire perché oggi si sente diverso da tre settimane fa.',
    },
  ]
  return (
    <section className="py-16 md:py-24 px-6 border-b border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">⚡</span>
            <span>Il problema reale</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            Sai già che lo stress cambia tutto. <em className="italic text-teal">Ma riesci a misurarlo davvero?</em>
          </h2>
          <p className="mt-5 text-[17px] text-anthracite-light leading-relaxed">
            Ogni giorno lavori con persone che dormono male, recuperano lentamente, si infortunano sempre
            nello stesso periodo, non rispondono come dovrebbero al protocollo. Tu sai che dietro c&apos;è il
            sistema nervoso. Ma non hai un numero da mostrare.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {cards.map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-gray-200 bg-white p-6"
            >
              <div className="text-2xl" aria-hidden="true">{c.icon}</div>
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
      <div className="text-[11px] uppercase tracking-wider text-anthracite-lighter font-medium">{label}</div>
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
  const features = [
    {
      title: 'Indice di Stress',
      body:
        'Sai esattamente quanto il simpatico sta dominando. Intervieni prima che il cliente arrivi al collasso, non dopo.',
    },
    {
      title: 'Indice di Recupero',
      body:
        'Smetti di indovinare se è pronto per un carico maggiore. Il numero ti dice quando spingere e quando fermarsi.',
    },
    {
      title: 'Indice di Equilibrio',
      body:
        "La firma del sistema nervoso autonomo. In un colpo d'occhio vedi se il bilanciamento simpatico-parasimpatico è dove deve essere.",
    },
    {
      title: 'Indice di Energia',
      body:
        'Le riserve reali, non quelle percepite. Fondamentale per chi lavora su burnout, performance sportiva o gestione delle energie.',
    },
  ]
  return (
    <section className="py-16 md:py-24 px-6 border-b border-gray-100">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 md:gap-20 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">📊</span>
            <span>La risposta</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            4 numeri. <em className="italic text-teal">Tutto quello che ti serve.</em>
          </h2>
          <p className="mt-5 text-[17px] text-anthracite-light leading-relaxed">
            Stress Index elabora 24 parametri HRV e li traduce in 4 indici su scala 0-100.
            Tu li leggi in un secondo. Il cliente li capisce senza spiegazioni.
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
              <ScoreCard label="Stress" value={72} color="#E85D4A" />
              <ScoreCard label="Recupero" value={68} color="#4FA39A" />
              <ScoreCard label="Equilibrio" value={55} color="#F59E0B" />
              <ScoreCard label="Energia" value={63} color="#6366F1" />
            </div>
            <div className="mt-5 rounded-lg border-l-4 border-teal bg-teal-light/50 px-4 py-3.5">
              <div className="text-[11px] uppercase tracking-wider text-teal-dark font-semibold">
                💡 Modulazione Infiammatoria
              </div>
              <div className="mt-1 text-[14px] text-anthracite leading-relaxed">
                <span className="font-semibold">58/100</span> · Attività vagale nella norma per fascia demografica.
                Consigliato monitoraggio settimanale.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      num: '01',
      icon: '🩺',
      title: 'Collega la fascia',
      body:
        'Qualsiasi fascia cardio Bluetooth. Il Polar H10 è il riferimento per qualità ECG, ma funziona con molti altri sensori. Un minuto e sei pronto.',
    },
    {
      num: '02',
      icon: '⏱️',
      title: 'Misura in 10 minuti',
      body:
        'Il cliente si siede, tu avvii la misurazione. Stress Index legge il segnale in tempo reale e filtra automaticamente gli artefatti. Zero configurazioni.',
    },
    {
      num: '03',
      icon: '📋',
      title: 'Condividi il report',
      body:
        "PDF professionale con i 4 indici, i grafici clinici e l'analisi del sistema nervoso autonomo. Lo invii al cliente con un tap. Lo stampi. Lo archivi nel CRM.",
    },
  ]
  return (
    <section id="come-funziona" className="py-16 md:py-24 px-6 scroll-mt-20 border-b border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">🎯</span>
            <span>Come funziona</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            Tre passi. <em className="italic text-teal">Poi hai il report.</em>
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {steps.map((s) => (
            <div
              key={s.num}
              className="relative bg-white rounded-xl p-6 border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl" aria-hidden="true">{s.icon}</span>
                <span className="font-mono text-[13px] text-anthracite-lighter tabular-nums" aria-hidden="true">
                  {s.num}
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
  const items = [
    {
      icon: '📱',
      title: 'Funziona su tutto',
      body:
        'Android, iOS, tablet, smartphone. Bluetooth 4.0 o superiore. Portalo in studio, in palestra, in campo. Nessun hardware proprietario da comprare.',
    },
    {
      icon: '👥',
      title: 'I tuoi clienti, organizzati',
      body:
        "CRM integrato con anagrafica, storico misurazioni e confronto tra sessioni. Vedi l'evoluzione nel tempo e aggiusti il protocollo con dati alla mano.",
    },
    {
      icon: '🇪🇺',
      title: 'Privacy garantita per legge',
      body:
        "Server in Germania, GDPR compliant, consenso del cliente registrato automaticamente. I dati non escono dall'Europa. Mai.",
    },
    {
      icon: '🔬',
      title: 'Scienza seria, linguaggio semplice',
      body:
        '24 parametri HRV su letteratura internazionale, normalizzazione demografica per età e sesso. Il rigore clinico che ti aspetti, senza la complessità che non ti serve.',
    },
  ]
  return (
    <section id="benefici" className="py-16 md:py-24 px-6 scroll-mt-20 border-b border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">💡</span>
            <span>Perché Stress Index</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            Costruito per chi lavora <em className="italic text-teal">nel benessere reale.</em>
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-5">
          {items.map((b) => (
            <div
              key={b.title}
              className="bg-white rounded-xl p-6 border border-gray-200"
            >
              <div className="text-2xl" aria-hidden="true">
                {b.icon}
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

function Pricing() {
  const features = [
    'Clienti e misurazioni illimitati',
    'Report PDF professionali illimitati',
    'CRM clienti con storico completo',
    'Export CSV dei dati',
    'Android e iOS inclusi',
    'Aggiornamenti automatici per sempre',
    'Supporto prioritario via email',
  ]
  return (
    <section id="prezzi" className="py-16 md:py-24 px-6 scroll-mt-20 border-b border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">💰</span>
            <span>Pricing</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            Un abbonamento. <em className="italic text-teal">Tutto incluso, per sempre.</em>
          </h2>
          <p className="mt-5 text-[17px] text-anthracite-light leading-relaxed">
            Niente costi per cliente, niente report extra, niente sorprese. Paghi una cifra fissa ogni mese
            e usi tutto senza limiti.
          </p>
        </div>

        <div className="mt-12 mx-auto max-w-[640px] bg-white rounded-xl border border-gray-200 p-8 md:p-10">
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-light text-teal-dark text-[13px] font-medium">
              <span aria-hidden="true">⭐</span> Offerta Founding Members · Primi 200 iscritti
            </span>
          </div>

          <div className="mt-6 text-center">
            <h3 className="font-serif text-2xl md:text-3xl text-anthracite tracking-tight">Stress Index Pro</h3>
            <p className="mt-2 text-anthracite-light text-[15px]">
              Per fisioterapisti, osteopati, medici sportivi e coach del benessere
            </p>
          </div>

          <div className="mt-6 text-center">
            <div className="font-serif text-5xl text-anthracite tracking-tight">
              € 49,90
              <span className="text-xl text-anthracite-light font-sans font-normal"> /mese</span>
            </div>
            <p className="mt-3 text-sm text-anthracite-lighter">
              Prezzo standard <s>69,90€/mese</s> · Founding Members 49,90€/mese per i primi 200
            </p>
          </div>

          <div className="mt-6 rounded-lg border-l-4 border-teal bg-teal-light/50 px-4 py-3 flex items-start gap-3">
            <span aria-hidden="true" className="text-lg leading-none mt-0.5">🎯</span>
            <p className="text-[14px] text-anthracite leading-relaxed">
              Sei tra i primi 200 iscritti? Il prezzo di{' '}
              <strong>49,90€/mese</strong> è bloccato per sempre.
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
            Inizia 15 giorni gratis
            <span className="ml-2" aria-hidden="true">→</span>
          </Link>

          <p className="mt-4 text-center text-sm text-anthracite-lighter">
            Carta di credito richiesta · Nessun addebito per 15 giorni · Poi 49,90€/mese · Disdici quando vuoi
          </p>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  const items = [
    {
      q: 'Ho bisogno del Polar H10?',
      a: 'No. Funziona con qualsiasi fascia cardio Bluetooth. Il Polar H10 è quello che consigliamo per la qualità del segnale ECG, specialmente su Android, ma non è obbligatorio.',
    },
    {
      q: 'Funziona su iPhone?',
      a: 'Sì. Android e iOS, tablet e smartphone. Qualsiasi dispositivo con Bluetooth 4.0.',
    },
    {
      q: 'I dati dei miei clienti sono al sicuro?',
      a: "Server in Germania, GDPR compliant. I dati non vengono mai condivisi con terzi. Il consenso del cliente viene registrato automaticamente dall'app ad ogni misurazione.",
    },
    {
      q: 'Posso usarlo senza internet?',
      a: 'La misurazione è completamente offline. I dati si sincronizzano automaticamente quando torni online. Non perdi nessuna sessione.',
    },
    {
      q: 'Cosa succede dopo i 15 giorni?',
      a: "Ti arriva una notifica prima della scadenza. Se vuoi continuare, l'abbonamento parte in automatico. Se no, annulli e non ti addebitiamo niente. Zero burocrazia.",
    },
    {
      q: 'Il prezzo Founding Members dura quanto?',
      a: 'Per sempre. I primi 200 professionisti che si iscrivono bloccano 49,90€/mese a vita, anche quando il prezzo standard salirà a 69,90€/mese.',
    },
  ]
  return (
    <section id="faq" className="py-16 md:py-24 px-6 scroll-mt-20 border-b border-gray-100">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-anthracite-lighter uppercase tracking-wider">
            <span aria-hidden="true">❓</span>
            <span>Domande frequenti</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            Tutto chiaro, <em className="italic text-teal">prima di iniziare.</em>
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
  return (
    <section className="py-16 md:py-24 px-6 border-b border-gray-100">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl bg-teal-light/50 border border-teal-mid/40 p-8 md:p-12 text-center">
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-teal-dark uppercase tracking-wider">
            <span aria-hidden="true">🚀</span>
            <span>Inizia oggi</span>
          </div>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl leading-tight tracking-tight text-anthracite">
            Il prossimo cliente che entra, <em className="italic text-teal">misuralo davvero.</em>
          </h2>
          <p className="mt-4 text-[17px] text-anthracite-light leading-relaxed">
            15 giorni gratis. Nessun vincolo. Smetti quando vuoi.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/registrazione"
              className="inline-flex items-center justify-center px-6 py-3 bg-teal text-white font-medium rounded-lg hover:bg-teal-dark transition-colors"
            >
              Prova gratis 15 giorni
              <span className="ml-2" aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="mt-4 text-sm text-anthracite-lighter">
            Carta di credito richiesta · Poi 49,90€/mese · Disdici in qualsiasi momento
          </p>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-white px-6 pt-16 pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-10 md:gap-12">
          <div>
            <Logo />
            <p className="mt-4 text-[14px] text-anthracite-light leading-relaxed max-w-sm">
              Software HRV professionale per fisioterapisti, osteopati, medici sportivi e coach del benessere.
              Misura lo stress del sistema nervoso autonomo in 10 minuti.
            </p>
          </div>

          <div>
            <h4 className="text-[12px] uppercase tracking-wider text-anthracite-lighter font-semibold">Prodotto</h4>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><a className="text-anthracite-light hover:text-teal transition-colors" href="#come-funziona">Come funziona</a></li>
              <li><a className="text-anthracite-light hover:text-teal transition-colors" href="#benefici">Funzionalità</a></li>
              <li><a className="text-anthracite-light hover:text-teal transition-colors" href="#prezzi">Prezzi</a></li>
              <li><Link className="text-anthracite-light hover:text-teal transition-colors" href="/registrazione">Inizia gratis</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[12px] uppercase tracking-wider text-anthracite-lighter font-semibold">Supporto</h4>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><Link className="text-anthracite-light hover:text-teal transition-colors" href="/guide">Guide e Supporto</Link></li>
              <li><a className="text-anthracite-light hover:text-teal transition-colors" href="#faq">FAQ</a></li>
              <li><a className="text-anthracite-light hover:text-teal transition-colors" href="mailto:support@stressindex.io">Contattaci</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[12px] uppercase tracking-wider text-anthracite-lighter font-semibold">Legale</h4>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><a className="text-anthracite-light hover:text-teal transition-colors" href="/privacy">Privacy Policy</a></li>
              <li><a className="text-anthracite-light hover:text-teal transition-colors" href="/termini">Termini di Servizio</a></li>
              <li><a className="text-anthracite-light hover:text-teal transition-colors" href="/cookie">Cookie Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col md:flex-row md:items-end md:justify-between gap-6 text-[13px] text-anthracite-lighter">
          <div className="leading-relaxed">
            <div className="font-medium text-anthracite-light">Minimax Srl</div>
            <div>Via Francesco Baracca, 88 · 36100 Vicenza (VI) · Italy</div>
            <div>P.IVA 04496840242</div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 md:justify-end">
            <span>© 2026 Minimax Srl · Tutti i diritti riservati</span>
            <a className="hover:text-teal transition-colors" href="/privacy">Privacy Policy</a>
            <a className="hover:text-teal transition-colors" href="/termini">Termini</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function Home() {
  return (
    <main className="bg-white text-anthracite">
      <Navbar />
      <Hero />
      <TrustBar />
      <Problem />
      <Solution />
      <HowItWorks />
      <Benefits />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  )
}
