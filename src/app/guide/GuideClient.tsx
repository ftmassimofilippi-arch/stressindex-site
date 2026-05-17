'use client'

import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import GuideChatWidget from '@/components/GuideChatWidget'

type SectionDef = {
  id: string
  title: string
  /** Plain text usato dal filtro di ricerca, generato dal contenuto. */
  searchText: string
  /** Render JSX della sezione. */
  render: () => React.ReactNode
}

type FaqItem = {
  q: string
  a: React.ReactNode
  /** Versione plain text per la ricerca. */
  searchText: string
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "L'app si è chiusa durante la misurazione",
    searchText:
      "L'app si è chiusa durante la misurazione meno di 1 minuto dati persi più di 1 minuto salvato storico Android Impostazioni App Stress Index Batteria Nessuna restrizione",
    a: (
      <>
        <p>
          Se la misurazione era in corso da meno di 1 minuto i dati sono persi.
          Se era in corso da più di 1 minuto l&apos;app potrebbe aver salvato i
          dati automaticamente. Riapri l&apos;app e controlla lo storico del
          cliente.
        </p>
        <p className="mt-2">
          Su Android, vai in Impostazioni, App, Stress Index, Batteria, Nessuna
          restrizione.
        </p>
      </>
    ),
  },
  {
    q: 'I valori sembrano strani',
    searchText:
      'valori strani fascia ben posizionata bagnata artifact rate sopra 5% non affidabile movimento parlare artefatti',
    a: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Verifica che la fascia fosse ben posizionata e bagnata.</li>
        <li>
          Controlla l&apos;artifact rate, se è sopra il 5% la misurazione
          potrebbe non essere affidabile.
        </li>
        <li>
          Il cliente si è mosso o ha parlato durante la misurazione? Il
          movimento crea artefatti.
        </li>
      </ul>
    ),
  },
  {
    q: 'Non riesco a vedere i dati sulla dashboard web',
    searchText:
      'dashboard web stesso account app stressindex.io area-professionisti sincronizzano internet sync',
    a: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          Verifica di essere loggato con lo stesso account su app e web (
          <a
            href="/area-professionisti/login"
            className="text-teal hover:text-teal-dark underline"
          >
            stressindex.io/area-professionisti
          </a>
          ).
        </li>
        <li>
          I dati si sincronizzano automaticamente, ma serve connessione
          internet.
        </li>
        <li>
          Se i dati non appaiono, chiudi e riapri l&apos;app con internet
          attivo per forzare il sync.
        </li>
      </ul>
    ),
  },
  {
    q: 'Il PDF non si genera',
    searchText:
      'PDF non si genera misurazione completa interrotta chiudere riaprire risultati contattaci',
    a: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Verifica che la misurazione sia completa, non interrotta.</li>
        <li>Prova a chiudere e riaprire i risultati.</li>
        <li>
          Se persiste, contattaci a{' '}
          <a
            href="mailto:support@stressindex.io"
            className="text-teal hover:text-teal-dark underline"
          >
            support@stressindex.io
          </a>
          .
        </li>
      </ul>
    ),
  },
  {
    q: 'Come resetto la password?',
    searchText:
      'reset password dimenticata login email istruzioni',
    a: (
      <p>
        Nella schermata di login tappa &quot;Password dimenticata&quot;,
        inserisci la tua email e segui le istruzioni.
      </p>
    ),
  },
]

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-md border-2 border-teal/40 bg-teal-light flex-shrink-0"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 12L10 17L19 7"
                stroke="#2E746C"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-[15px] text-anthracite-light leading-relaxed">
            {item}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-teal text-white text-[13px] font-semibold flex items-center justify-center">
        {n}
      </span>
      <span className="pt-0.5 text-[15px] text-anthracite-light leading-relaxed">
        {children}
      </span>
    </li>
  )
}

function TroubleshootBlock({
  title,
  bullets,
}: {
  title: string
  bullets: React.ReactNode[]
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface/60 p-4 sm:p-5">
      <p className="font-medium text-anthracite mb-3">&ldquo;{title}&rdquo;</p>
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[14.5px] text-anthracite-light leading-relaxed"
          >
            <span className="text-teal mt-0.5">→</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Callout({
  title,
  children,
  variant = 'info',
}: {
  title?: string
  children: React.ReactNode
  variant?: 'info' | 'warn'
}) {
  const isWarn = variant === 'warn'
  return (
    <div
      className={`rounded-xl p-4 sm:p-5 border ${
        isWarn
          ? 'bg-amber-50 border-amber-200'
          : 'bg-teal-light/60 border-teal-mid/60'
      }`}
    >
      {title && (
        <p
          className={`font-semibold mb-1.5 ${
            isWarn ? 'text-amber-900' : 'text-teal-dark'
          }`}
        >
          {title}
        </p>
      )}
      <div
        className={`text-[14.5px] leading-relaxed ${
          isWarn ? 'text-amber-900/90' : 'text-anthracite'
        }`}
      >
        {children}
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
  color: string
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-white p-5">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-xl" aria-hidden="true">
          {emoji}
        </span>
        <h4 className="font-semibold text-anthracite">{title}</h4>
      </div>
      <p className="text-[14.5px] text-anthracite-light leading-relaxed">
        {desc}
      </p>
      {ranges && (
        <div className="mt-3 pt-3 border-t border-surface-border space-y-1.5">
          {ranges.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px]">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color, opacity: 0.4 + i * 0.15 }}
                aria-hidden="true"
              />
              <span className="font-mono text-anthracite tabular-nums">
                {r.range}
              </span>
              <span className="text-anthracite-light">{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const SENSOR_TABLE: {
  status: 'ok' | 'limit' | 'no'
  name: string
  note: string
}[] = [
  {
    status: 'ok',
    name: 'Polar H10 (90€)',
    note: 'Il nostro standard, ECG, precisione massima. Consigliato.',
  },
  {
    status: 'ok',
    name: 'Polar H9 (50€)',
    note: 'Stessa qualità ECG del H10, ottimo rapporto qualità prezzo.',
  },
  {
    status: 'ok',
    name: 'Polar OH1 / Verity Sense',
    note: 'Sensore ottico da braccio, funziona ma meno preciso di una fascia ECG.',
  },
  {
    status: 'limit',
    name: 'Wahoo TICKR',
    note: 'Funziona, buona stabilità BLE. Da testare con la propria unità.',
  },
  {
    status: 'limit',
    name: 'CooSpo H808S',
    note: 'Funziona, economico (30€), qualità inferiore al Polar.',
  },
  {
    status: 'no',
    name: 'Whoop 4.0',
    note: 'Trasmette solo BPM, non gli intervalli RR necessari per l\'analisi HRV.',
  },
  {
    status: 'no',
    name: 'Fasce Garmin (HRM-Dual, HRM-Pro)',
    note: 'Non trasmettono RR intervals via BLE standard.',
  },
  {
    status: 'no',
    name: 'Apple Watch',
    note: 'Non trasmette dati ECG via BLE.',
  },
  {
    status: 'no',
    name: 'Smartwatch e smartband generici',
    note: 'Non adatti per analisi HRV professionale.',
  },
]

function StatusBadge({ s }: { s: 'ok' | 'limit' | 'no' }) {
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

function AccordionItem({
  item,
  open,
  onToggle,
}: {
  item: FaqItem
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left hover:bg-surface/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-inset"
      >
        <span className="font-medium text-anthracite">{item.q}</span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`text-anthracite-lighter flex-shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        >
          <path
            d="M6 9L12 15L18 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-5 pt-1 text-[15px] text-anthracite-light leading-relaxed border-t border-surface-border/60 animate-fade-in">
          {item.a}
        </div>
      )}
    </div>
  )
}

export default function GuideClient() {
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string>('sensori')
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

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return FAQ_ITEMS.map((_, i) => i)
    return FAQ_ITEMS.map((it, i) => ({ it, i }))
      .filter(
        ({ it }) =>
          it.q.toLowerCase().includes(q) ||
          it.searchText.toLowerCase().includes(q)
      )
      .map(({ i }) => i)
  }, [query])

  const sections: SectionDef[] = useMemo(
    () => [
      {
        id: 'sensori',
        title: 'Connessione sensori',
        searchText:
          'connessione sensori BLE bluetooth GPS localizzazione Android fascia toracica bagnata Polar Flow Garmin Connect accoppiato impostazioni telefono procedura passo passo seleziona sensore home connesso cuore lampeggia troubleshooting non appare nella lista riposizionare disconnette risparmio energetico batteria nessuna restrizione',
        render: () => (
          <>
            <p className="text-[15.5px] text-anthracite-light leading-relaxed">
              La guida più importante. Se hai un problema, parte quasi sempre da
              qui. Segui questi passaggi prima di scriverci, nel 90% dei casi
              risolvi in due minuti.
            </p>

            <h3 className="text-lg font-semibold text-anthracite mt-8 mb-4">
              Checklist pre-connessione
            </h3>
            <Checklist
              items={[
                'Bluetooth attivato sul telefono.',
                'GPS / Localizzazione attivata. Android richiede il permesso di localizzazione per scansionare dispositivi BLE, è una scelta del sistema operativo, l\'app non usa la tua posizione.',
                'Fascia toracica bagnata nei punti di contatto. Acqua del rubinetto o saliva, non gel.',
                'Nessun\'altra app è connessa al sensore. Polar Flow, Polar Beat, Garmin Connect, Strava, Wahoo, devono essere completamente chiuse, non solo in background.',
                'Il sensore NON è accoppiato nelle impostazioni Bluetooth del telefono. Deve connettersi solo tramite Stress Index, non dal sistema. Se l\'hai accoppiato manualmente, rimuovilo dalle impostazioni BT.',
              ]}
            />

            <h3 className="text-lg font-semibold text-anthracite mt-8 mb-4">
              Procedura passo passo
            </h3>
            <ol className="space-y-3">
              <Step n={1}>Indossa la fascia, bagnala bene sui contatti.</Step>
              <Step n={2}>Apri Stress Index.</Step>
              <Step n={3}>
                Tappa &ldquo;Seleziona sensore&rdquo; nella home.
              </Step>
              <Step n={4}>Attendi che il sensore appaia nella lista.</Step>
              <Step n={5}>Tappa sul nome del sensore.</Step>
              <Step n={6}>
                Attendi lo stato &ldquo;Connesso&rdquo; con il cuore che
                lampeggia.
              </Step>
              <Step n={7}>Sei pronto per misurare.</Step>
            </ol>

            <h3 className="text-lg font-semibold text-anthracite mt-8 mb-4">
              Troubleshooting connessione
            </h3>
            <div className="space-y-3">
              <TroubleshootBlock
                title="Il sensore non appare nella lista"
                bullets={[
                  'Verifica che la fascia sia indossata, il sensore si attiva solo a contatto con la pelle.',
                  'Chiudi e riapri l\'app.',
                  'Disattiva e riattiva il Bluetooth.',
                  'Su Android, verifica che il GPS sia acceso.',
                  'Verifica che nessun\'altra app sia connessa al sensore.',
                  'Rimuovi il sensore dalle impostazioni Bluetooth del telefono se lo hai accoppiato manualmente.',
                ]}
              />
              <TroubleshootBlock
                title="Si connette ma non arrivano dati"
                bullets={[
                  'Riposiziona la fascia e bagna di nuovo i contatti.',
                  'Prova ad avvicinare il telefono al sensore.',
                  'Chiudi l\'app completamente e riapri.',
                  'Se persiste, riavvia il telefono.',
                ]}
              />
              <TroubleshootBlock
                title="Si disconnette durante la misurazione"
                bullets={[
                  'Non allontanarti troppo dal telefono, massimo 3 metri.',
                  'Su Android, verifica che il risparmio energetico non chiuda l\'app in background.',
                  'Impostazioni → App → Stress Index → Batteria → Nessuna restrizione.',
                ]}
              />
            </div>
          </>
        ),
      },
      {
        id: 'sensori-compatibili',
        title: 'Sensori compatibili',
        searchText:
          'sensori compatibili Polar H10 H9 OH1 Verity Sense Wahoo TICKR CooSpo H808S Whoop Garmin HRM-Dual HRM-Pro Apple Watch smartwatch smartband intervalli RR BPM',
        render: () => (
          <>
            <p className="text-[15.5px] text-anthracite-light leading-relaxed">
              Per fare HRV serve un sensore che trasmetta gli intervalli RR
              beat-to-beat via Bluetooth. Non tutti i cardiofrequenzimetri lo
              fanno. Ecco l&apos;elenco aggiornato.
            </p>

            <div className="mt-6 rounded-xl border border-surface-border overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-surface text-[13px] uppercase tracking-wider text-anthracite-lighter font-semibold">
                  <tr>
                    <th className="px-4 py-3">Sensore</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Stato</th>
                    <th className="px-4 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="text-[14.5px]">
                  {SENSOR_TABLE.map((s, i) => (
                    <tr
                      key={s.name}
                      className={`${
                        i % 2 === 0 ? 'bg-white' : 'bg-surface/60'
                      } border-t border-surface-border`}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-anthracite">
                          {s.name}
                        </div>
                        <div className="sm:hidden mt-1">
                          <StatusBadge s={s.status} />
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top hidden sm:table-cell">
                        <StatusBadge s={s.status} />
                      </td>
                      <td className="px-4 py-3 align-top text-anthracite-light">
                        {s.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <Callout title="Perché servono gli intervalli RR?">
                L&apos;HRV misura la variazione tra un battito e l&apos;altro
                con precisione al millisecondo. Un semplice dato BPM (battiti
                al minuto) è una media, e perde tutta l&apos;informazione sulla
                variabilità. Per questo servono sensori che trasmettono gli
                intervalli RR beat-to-beat.
              </Callout>
            </div>
          </>
        ),
      },
      {
        id: 'prima-misurazione',
        title: 'La prima misurazione',
        searchText:
          'prima misurazione setup ambiente tranquillo luce soffusa temperatura notifiche silenziose seduto supino 2 minuti posizione standardizzata respirazione naturale durata 5 minuti 10 minuti Task Force ESC NASPE 1996 trattamenti intervalli RR filtra artefatti',
        render: () => (
          <>
            <h3 className="text-lg font-semibold text-anthracite mb-3">
              Setup dell&apos;ambiente
            </h3>
            <p className="text-[15.5px] text-anthracite-light leading-relaxed">
              Ambiente tranquillo, luce soffusa, temperatura confortevole.
              Niente telefonate, notifiche silenziose. Il cliente deve essere
              seduto o supino da almeno 2 minuti prima di iniziare, il tempo
              che il sistema nervoso si assesti.
            </p>

            <h3 className="text-lg font-semibold text-anthracite mt-7 mb-3">
              Posizione
            </h3>
            <p className="text-[15.5px] text-anthracite-light leading-relaxed">
              Seduto con schiena appoggiata, piedi a terra, mani sulle cosce.
              Oppure supino. L&apos;importante è standardizzare, usa sempre la
              stessa posizione per lo stesso cliente, altrimenti i confronti
              tra sessioni perdono significato.
            </p>

            <h3 className="text-lg font-semibold text-anthracite mt-7 mb-3">
              Respirazione
            </h3>
            <p className="text-[15.5px] text-anthracite-light leading-relaxed">
              Naturale. Non dire al cliente di respirare lentamente per
              rilassarsi, altrimenti invalidi lo spettro e ottieni un quadro
              non rappresentativo. Spiegagli che deve respirare come fa
              normalmente.
            </p>

            <h3 className="text-lg font-semibold text-anthracite mt-7 mb-3">
              Durata
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-anthracite-light leading-relaxed">
              <li>
                <span className="font-medium text-anthracite">5 minuti</span> è
                lo standard scientifico (Task Force ESC/NASPE 1996).
              </li>
              <li>
                <span className="font-medium text-anthracite">10 minuti</span>{' '}
                per un&apos;analisi più stabile e meno influenzata da
                fluttuazioni momentanee.
              </li>
              <li>
                <span className="font-medium text-anthracite">
                  Durata libera
                </span>{' '}
                per sessioni durante trattamenti, dove vuoi monitorare la
                risposta nel tempo.
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-anthracite mt-7 mb-3">
              Cosa succede durante
            </h3>
            <p className="text-[15.5px] text-anthracite-light leading-relaxed">
              L&apos;app raccoglie gli intervalli RR dal sensore, li filtra
              dagli artefatti in tempo reale, e alla fine calcola tutti i
              parametri. Non toccare il telefono durante la misurazione, lascia
              che l&apos;app lavori indisturbata.
            </p>
          </>
        ),
      },
      {
        id: 'tipi-test',
        title: 'I 3 tipi di test',
        searchText:
          'tipi test misurazione standard tonico fasico test ortostatico Indice Reattività Ortostatica supino piedi 5 minuti respirazione coerenza cardiaca animazione sfera 6 respiri minuto Score Coerenza frequenza risonanza ansia insonnia dolore cronico',
        render: () => (
          <>
            <div className="space-y-6">
              <div className="rounded-xl border border-surface-border bg-white p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal" />
                  <h3 className="text-lg font-semibold text-anthracite">
                    Misurazione standard (test tonico)
                  </h3>
                </div>
                <dl className="space-y-3 text-[15px] text-anthracite-light leading-relaxed">
                  <div>
                    <dt className="font-medium text-anthracite">
                      Cos&apos;è
                    </dt>
                    <dd>
                      Fotografia dello stato attuale del sistema nervoso
                      autonomo a riposo.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-anthracite">
                      Quando usarla
                    </dt>
                    <dd>
                      È il default, va bene nel 70% dei casi. Valutazioni
                      periodiche, monitoraggio, prima visita.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-anthracite">Durata</dt>
                    <dd>5 o 10 minuti.</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-anthracite">Posizione</dt>
                    <dd>Seduto o supino, sempre uguale per lo stesso cliente.</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-surface-border bg-white p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h3 className="text-lg font-semibold text-anthracite">
                    Test ortostatico (test fasico)
                  </h3>
                </div>
                <dl className="space-y-3 text-[15px] text-anthracite-light leading-relaxed">
                  <div>
                    <dt className="font-medium text-anthracite">
                      Cos&apos;è
                    </dt>
                    <dd>
                      Misura la capacità del sistema nervoso di reagire a uno
                      stimolo, il passaggio da supino a in piedi.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-anthracite">
                      Come funziona
                    </dt>
                    <dd>
                      5 minuti supino, poi l&apos;app ti avvisa con suono e
                      vibrazione di alzarti, poi 5 minuti in piedi.
                      L&apos;app analizza entrambe le fasi e le confronta.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-anthracite">
                      Quando usarlo
                    </dt>
                    <dd>
                      Disautonomie, sindromi post-infettive (long COVID),
                      atleti sovrallenati, valutazione iniziale approfondita.
                      Ogni 4-6 settimane come stress test del sistema nervoso.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-anthracite">
                      Il report mostra
                    </dt>
                    <dd>
                      Indice di Reattività Ortostatica (0-100) e confronto
                      supino vs in piedi per ogni parametro.
                    </dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <Callout variant="warn">
                    Non confrontare mai un test ortostatico con una
                    misurazione standard, sono cose diverse.
                  </Callout>
                </div>
              </div>

              <div className="rounded-xl border border-surface-border bg-white p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <h3 className="text-lg font-semibold text-anthracite">
                    Respirazione di coerenza
                  </h3>
                </div>
                <dl className="space-y-3 text-[15px] text-anthracite-light leading-relaxed">
                  <div>
                    <dt className="font-medium text-anthracite">
                      Cos&apos;è
                    </dt>
                    <dd>
                      Il cliente respira seguendo un&apos;animazione visiva a
                      una frequenza impostata (di default 6 respiri al
                      minuto).
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-anthracite">
                      Come funziona
                    </dt>
                    <dd>
                      L&apos;app mostra una sfera che si espande (inspira) e
                      si contrae (espira). Il cliente segue il ritmo. Intanto
                      l&apos;app calcola lo Score di Coerenza in tempo reale.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-anthracite">
                      Quando usarla
                    </dt>
                    <dd>
                      Training di coerenza cardiaca, valutazione del massimo
                      potenziale vagale, ricerca della frequenza di risonanza
                      personale. Utile per ansia, insonnia, dolore cronico,
                      preparazione mentale.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-anthracite">
                      Frequenza di risonanza
                    </dt>
                    <dd>
                      Varia da persona a persona, tra 4.5 e 7.5 respiri/min.
                      Puoi testare diverse frequenze in sessioni da 2-3 minuti
                      e vedere quale produce il picco LF più alto nello
                      spettro.
                    </dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <Callout variant="warn">
                    Non usare la coerenza come misurazione di valutazione.
                    Per valutare il cliente usa sempre il test standard. La
                    coerenza misura il potenziale, non lo stato attuale.
                  </Callout>
                </div>
              </div>
            </div>
          </>
        ),
      },
      {
        id: 'risultati',
        title: 'Leggere i risultati',
        searchText:
          'risultati 5 score Indice Stress Recupero Equilibrio Energia Modulazione Infiammatoria Tracey 2002 riflesso antinfiammatorio colinergico Stress Index Composito tachimetro parametri avanzati Time Domain Frequency Domain Non-linear Geometric semaforo verde giallo rosso range normativi età sesso',
        render: () => (
          <>
            <p className="text-[15.5px] text-anthracite-light leading-relaxed">
              Ogni score va da 0 a 100. Sono calcolati combinando più parametri
              HRV con pesi scientificamente validati. Sono il modo più rapido
              per leggere lo stato del cliente senza doverti immergere nei
              singoli parametri.
            </p>

            <h3 className="text-lg font-semibold text-anthracite mt-7 mb-4">
              I 5 score proprietari
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <ScoreCard
                emoji="🔴"
                title="Indice di Stress (0-100)"
                desc="Quanto è sotto pressione il sistema nervoso. Se è alto cronicamente indica stress accumulato nel tempo, non solo il momento della misurazione."
                color="#E85D4A"
                ranges={[
                  { range: '0–30', label: 'Basso' },
                  { range: '30–50', label: 'In equilibrio' },
                  { range: '50–70', label: 'Medio' },
                  { range: '70–85', label: 'Alto' },
                  { range: '85–100', label: 'Esaurimento' },
                ]}
              />
              <ScoreCard
                emoji="🟢"
                title="Recupero (0-100)"
                desc="Capacità di recupero del sistema parasimpatico."
                color="#4FA39A"
                ranges={[
                  { range: '0–25', label: 'Insufficiente' },
                  { range: '25–45', label: 'Scarso' },
                  { range: '45–65', label: 'Moderato' },
                  { range: '65–85', label: 'Buono' },
                  { range: '85–100', label: 'Ottimale' },
                ]}
              />
              <ScoreCard
                emoji="🔵"
                title="Equilibrio (0-100)"
                desc="Bilanciamento tra simpatico e parasimpatico. Non è 'più alto = meglio', il valore ottimale è nella zona centrale. Troppo sbilanciato in entrambe le direzioni è problematico."
                color="#3B82F6"
              />
              <ScoreCard
                emoji="🟠"
                title="Energia (0-100)"
                desc="Risorse energetiche complessive del sistema nervoso. Basato sulla potenza totale dello spettro HRV."
                color="#F59E0B"
              />
              <ScoreCard
                emoji="🟣"
                title="Modulazione Infiammatoria (0-100)"
                desc="Capacità del sistema vagale di modulare l'infiammazione. Basato sul riflesso antinfiammatorio colinergico (Tracey 2002). Più è alto, migliore è la capacità del corpo di tenere sotto controllo l'infiammazione."
                color="#A855F7"
              />
            </div>

            <h3 className="text-lg font-semibold text-anthracite mt-8 mb-3">
              Stress Index Composito
            </h3>
            <p className="text-[15.5px] text-anthracite-light leading-relaxed">
              Valore unico 0-100 che sintetizza tutti e 5 gli score. Si vede
              nel tachimetro in cima ai risultati. È il numero da monitorare
              nel tempo, soprattutto se confronti più sessioni dello stesso
              cliente.
            </p>

            <h3 className="text-lg font-semibold text-anthracite mt-7 mb-3">
              I parametri avanzati
            </h3>
            <p className="text-[15.5px] text-anthracite-light leading-relaxed">
              Sotto gli score trovi i dettagli per dominio (Time Domain,
              Frequency Domain, Non-linear, Geometric). Ogni parametro ha un
              semaforo (verde, giallo, rosso) basato sui range normativi per
              età e sesso del cliente.
            </p>
            <p className="mt-2 text-[15.5px] text-anthracite-light leading-relaxed">
              Non serve conoscerli tutti per usare l&apos;app, gli score sono
              sufficienti nella pratica quotidiana. I parametri avanzati ti
              servono se vuoi approfondire un caso specifico o confrontare con
              la letteratura.
            </p>
          </>
        ),
      },
      {
        id: 'confronto',
        title: 'Confronto sessioni',
        searchText:
          'confronto sessioni scheda cliente confronta delta frecce tendenza Score Time Frequency Non-linear Geometric parametri selezionati ortostatico standard stesse condizioni',
        render: () => (
          <>
            <ul className="space-y-3 text-[15px] text-anthracite-light leading-relaxed">
              <li>
                <span className="font-medium text-anthracite">
                  Come accedere
                </span>
                <br />
                Nella scheda cliente seleziona 2 o più misurazioni e tappa
                &ldquo;Confronta&rdquo;.
              </li>
              <li>
                <span className="font-medium text-anthracite">
                  Cosa mostra
                </span>
                <br />I parametri selezionati fianco a fianco con delta e
                frecce di tendenza.
              </li>
              <li>
                <span className="font-medium text-anthracite">
                  Organizzazione
                </span>
                <br />I parametri sono raggruppati per dominio (Score, Time,
                Frequency, Non-linear, Geometric).
              </li>
              <li>
                <span className="font-medium text-anthracite">
                  Personalizzazione
                </span>
                <br />
                Puoi selezionare quali parametri confrontare, di default vedi
                i 9 più importanti.
              </li>
            </ul>
            <div className="mt-5">
              <Callout title="Consiglio">
                Confronta sempre misurazioni dello stesso tipo (standard con
                standard, ortostatico con ortostatico) fatte nelle stesse
                condizioni. Altrimenti stai paragonando mele e pere.
              </Callout>
            </div>
          </>
        ),
      },
      {
        id: 'clienti',
        title: 'Gestione clienti',
        searchText:
          'gestione clienti aggiungere anagrafica nome cognome data nascita sesso fumatore atleta livello attività normalizzazione parametri età semafori storico note libere',
        render: () => (
          <>
            <ul className="space-y-4 text-[15px] text-anthracite-light leading-relaxed">
              <li>
                <span className="font-medium text-anthracite">
                  Aggiungere un cliente
                </span>
                <br />
                Tappa + nella lista clienti, compila l&apos;anagrafica (nome,
                cognome, data di nascita, sesso, fumatore, atleta, livello di
                attività).
              </li>
              <li>
                <span className="font-medium text-anthracite">
                  Perché l&apos;anagrafica è importante
                </span>
                <br />
                Età e sesso servono per la normalizzazione dei parametri.
                Senza questi dati i semafori verde/giallo/rosso non possono
                essere calcolati correttamente, quindi compilala sempre, anche
                quando hai fretta.
              </li>
              <li>
                <span className="font-medium text-anthracite">Storico</span>
                <br />
                Ogni misurazione viene salvata e associata al cliente. Puoi
                rivedere qualsiasi sessione passata in qualsiasi momento.
              </li>
              <li>
                <span className="font-medium text-anthracite">Note</span>
                <br />
                Puoi aggiungere note libere a ogni cliente. Usale per
                annotare contesto clinico, eventi rilevanti, obiettivi.
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'report-pdf',
        title: 'Report PDF',
        searchText:
          'report PDF icona alto destra 4 pagine score parametri grafici Poincaré ritmogramma spettro PSD disclaimer medico sessioni lunghe trend segmenti pre post trattamento WhatsApp email rullino foto profilo professionale titolo studio contatti',
        render: () => (
          <>
            <ul className="space-y-4 text-[15px] text-anthracite-light leading-relaxed">
              <li>
                <span className="font-medium text-anthracite">
                  Come generarlo
                </span>
                <br />
                Nei risultati della misurazione, tappa l&apos;icona PDF in
                alto a destra.
              </li>
              <li>
                <span className="font-medium text-anthracite">
                  Cosa contiene
                </span>
                <br />4 pagine con score, parametri completi, grafici
                (Poincaré, ritmogramma, spettro PSD) e disclaimer medico.
              </li>
              <li>
                <span className="font-medium text-anthracite">
                  Per le sessioni lunghe
                </span>
                <br />
                Pagine extra con trend dei segmenti e confronto pre/post
                trattamento.
              </li>
              <li>
                <span className="font-medium text-anthracite">
                  Condivisione
                </span>
                <br />
                Puoi inviarlo via WhatsApp, email o salvarlo nel rullino foto.
              </li>
              <li>
                <span className="font-medium text-anthracite">
                  Personalizzazione
                </span>
                <br />
                Se compili il tuo profilo professionale (titolo, studio,
                contatti), questi dati appariranno nel PDF, dando un&apos;aria
                più professionale al report consegnato al cliente.
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'problemi',
        title: 'Troubleshooting',
        searchText:
          'troubleshooting problemi app chiusa misurazione valori strani dashboard web PDF non genera password dimenticata FAQ',
        render: () => (
          <>
            <p className="text-[15.5px] text-anthracite-light leading-relaxed">
              Le risposte ai problemi più frequenti. Se non trovi quello che
              cerchi, scrivici a{' '}
              <a
                href="mailto:support@stressindex.io"
                className="text-teal hover:text-teal-dark underline"
              >
                support@stressindex.io
              </a>
              .
            </p>
            <div className="mt-6 space-y-3">
              {filteredFaqs.length === 0 && (
                <p className="text-[14.5px] text-anthracite-lighter italic">
                  Nessuna domanda corrisponde alla ricerca.
                </p>
              )}
              {filteredFaqs.map((i) => (
                <AccordionItem
                  key={i}
                  item={FAQ_ITEMS[i]}
                  open={openFaqs.has(i)}
                  onToggle={() => toggleFaq(i)}
                />
              ))}
            </div>
          </>
        ),
      },
      {
        id: 'supporto',
        title: 'Contatti e supporto',
        searchText:
          'contatti supporto email Telegram sito stressindex.io support@stressindex.io',
        render: () => (
          <>
            <p className="text-[15.5px] text-anthracite-light leading-relaxed">
              Tre canali per parlarci, dal più rapido al più strutturato.
            </p>
            <div className="mt-5 grid sm:grid-cols-2 gap-4">
              <a
                href="mailto:support@stressindex.io"
                className="block rounded-xl border border-surface-border bg-white p-5 hover:border-teal hover:shadow-card-hover transition-all"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 6L12 13L20 6M4 6V18H20V6M4 6H20"
                      stroke="#4FA39A"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="font-medium text-anthracite">Email</span>
                </div>
                <p className="text-[14px] text-anthracite-light">
                  support@stressindex.io
                </p>
              </a>

              <a
                href="https://t.me/stressindex"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-surface-border bg-white p-5 hover:border-teal hover:shadow-card-hover transition-all"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M21 4L3 11L10 14L13 21L21 4Z"
                      stroke="#4FA39A"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="font-medium text-anthracite">
                    Canale Telegram
                  </span>
                </div>
                <p className="text-[14px] text-anthracite-light">
                  Domande, aggiornamenti, community professionisti.
                </p>
              </a>

              <a
                href="https://stressindex.io"
                className="block rounded-xl border border-surface-border bg-white p-5 hover:border-teal hover:shadow-card-hover transition-all sm:col-span-2"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="#4FA39A"
                      strokeWidth="2"
                    />
                    <path
                      d="M3 12H21M12 3C14.5 6 14.5 18 12 21M12 3C9.5 6 9.5 18 12 21"
                      stroke="#4FA39A"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="font-medium text-anthracite">Sito</span>
                </div>
                <p className="text-[14px] text-anthracite-light">
                  stressindex.io
                </p>
              </a>
            </div>
          </>
        ),
      },
    ],
    [filteredFaqs, openFaqs]
  )

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections.filter((s) => {
      if (s.id === 'problemi') {
        if (filteredFaqs.length > 0) return true
      }
      return (
        s.title.toLowerCase().includes(q) ||
        s.searchText.toLowerCase().includes(q)
      )
    })
  }, [query, sections, filteredFaqs.length])

  // Scroll-spy: highlight active section in sidebar
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

  // Smooth scroll handler (compensa header sticky 64px)
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const y =
      el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top: y, behavior: 'smooth' })
    setMobileNavOpen(false)
  }

  // Apri automaticamente la sezione "problemi" se la ricerca filtra le FAQ
  useEffect(() => {
    if (query.trim() && filteredFaqs.length > 0) {
      setOpenFaqs(new Set(filteredFaqs))
    } else if (!query.trim()) {
      // niente, lascia chiuse di default
    }
  }, [query, filteredFaqs])

  const noResults = filteredSections.length === 0

  return (
    <>
      <Header />
      <main className="min-h-screen bg-surface pt-16">
        {/* Hero */}
        <div className="bg-gradient-to-b from-teal-light/40 to-transparent">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-light text-teal-dark text-[13px] font-medium rounded-full mb-4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 8v4M12 16h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Centro assistenza
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-anthracite tracking-tight">
                Guide e Supporto
              </h1>
              <p className="mt-3 text-lg text-anthracite-light leading-relaxed">
                Tutto quello che ti serve per usare Stress Index al meglio.
              </p>

              {/* Search */}
              <div className="mt-7 relative max-w-xl">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-anthracite-lighter pointer-events-none"
                  aria-hidden="true"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M21 21L16.5 16.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  type="search"
                  inputMode="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cerca nelle guide, ad esempio 'Polar H10' o 'ortostatico'…"
                  className="w-full pl-11 pr-11 py-3.5 bg-white border border-surface-border rounded-xl text-anthracite placeholder:text-anthracite-lighter focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all"
                  aria-label="Cerca nelle guide"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-anthracite-lighter hover:text-anthracite p-1 rounded-md"
                    aria-label="Cancella ricerca"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M6 6L18 18M6 18L18 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        <div className="md:hidden sticky top-16 z-30 bg-surface/95 backdrop-blur border-b border-surface-border">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-expanded={mobileNavOpen}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-white border border-surface-border rounded-xl text-left"
            >
              <span className="text-[14.5px] font-medium text-anthracite">
                {sections.find((s) => s.id === activeId)?.title ?? 'Sezioni'}
              </span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className={`transition-transform ${
                  mobileNavOpen ? 'rotate-180' : ''
                } text-anthracite-lighter`}
              >
                <path
                  d="M6 9L12 15L18 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {mobileNavOpen && (
              <div className="mt-2 bg-white border border-surface-border rounded-xl overflow-hidden">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollToSection(s.id)}
                    className={`w-full text-left px-4 py-2.5 text-[14.5px] border-t border-surface-border first:border-t-0 ${
                      activeId === s.id
                        ? 'bg-teal-light/60 text-teal-dark font-medium'
                        : 'text-anthracite hover:bg-surface'
                    }`}
                  >
                    {s.title}
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
              <nav
                aria-label="Indice guide"
                className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-auto pr-2"
              >
                <p className="text-[12px] uppercase tracking-wider text-anthracite-lighter font-semibold mb-3">
                  Indice
                </p>
                <ul className="space-y-1">
                  {sections.map((s, i) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => scrollToSection(s.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[14px] transition-colors ${
                          activeId === s.id
                            ? 'bg-teal-light text-teal-dark font-medium'
                            : 'text-anthracite-light hover:bg-surface hover:text-anthracite'
                        }`}
                      >
                        <span className="text-anthracite-lighter font-mono text-[12px] mr-2 tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {s.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            {/* Sections */}
            <div className="min-w-0 max-w-3xl">
              {noResults && (
                <div className="rounded-xl border border-dashed border-surface-border p-8 text-center bg-white">
                  <p className="text-anthracite font-medium">
                    Nessun risultato per &ldquo;{query}&rdquo;.
                  </p>
                  <p className="mt-1 text-[14px] text-anthracite-light">
                    Prova con un altro termine, oppure{' '}
                    <a
                      href="mailto:support@stressindex.io"
                      className="text-teal hover:text-teal-dark underline"
                    >
                      scrivici
                    </a>
                    .
                  </p>
                </div>
              )}

              <div className="space-y-14">
                {filteredSections.map((s, i) => (
                  <section
                    key={s.id}
                    id={s.id}
                    aria-labelledby={`${s.id}-title`}
                    className="scroll-mt-24"
                  >
                    <div className="flex items-baseline gap-3 mb-5">
                      <span className="text-[13px] font-mono text-teal tabular-nums">
                        {String(sections.indexOf(s) + 1).padStart(2, '0')}
                      </span>
                      <h2
                        id={`${s.id}-title`}
                        className="text-2xl sm:text-[28px] font-semibold text-anthracite tracking-tight"
                      >
                        {s.title}
                      </h2>
                      <a
                        href={`#${s.id}`}
                        aria-label="Link a questa sezione"
                        className="ml-auto text-anthracite-lighter hover:text-teal transition-colors opacity-0 hover:opacity-100 focus:opacity-100"
                      >
                        #
                      </a>
                    </div>
                    <div className="text-anthracite">
                      {s.render()}
                    </div>
                    {i < filteredSections.length - 1 && (
                      <div className="mt-14 border-t border-surface-border" />
                    )}
                  </section>
                ))}
              </div>

              {/* AI assistant promo */}
              <section
                aria-labelledby="ai-help-title"
                className="mt-20 rounded-2xl border border-teal-mid/60 bg-gradient-to-br from-teal-light/60 to-white p-6 sm:p-8"
              >
                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex w-12 h-12 rounded-xl bg-teal text-white items-center justify-center flex-shrink-0 shadow-card">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2
                      id="ai-help-title"
                      className="text-xl sm:text-2xl font-semibold text-anthracite tracking-tight"
                    >
                      Non trovi quello che cerchi?
                    </h2>
                    <p className="mt-2 text-[15.5px] text-anthracite-light leading-relaxed max-w-2xl">
                      Usa l&apos;assistente in basso a destra per fare domande
                      in tempo reale. Ha letto tutte le guide e può
                      risponderti subito.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Back to top (a sinistra per non collidere col chat launcher) */}
        {showBackTop && (
          <button
            type="button"
            onClick={() =>
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
            aria-label="Torna su"
            className="fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full bg-anthracite text-white shadow-elevated hover:bg-teal-dark transition-colors flex items-center justify-center"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 19V5M12 5L5 12M12 5L19 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </main>
      <Footer />
      <GuideChatWidget />
    </>
  )
}
