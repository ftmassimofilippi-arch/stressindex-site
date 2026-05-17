import type { Metadata } from 'next'
import GuideClient from './GuideClient'

export const metadata: Metadata = {
  title: 'Guide e Supporto',
  description:
    'Come usare Stress Index: connessione sensori, tipi di test HRV, leggere i risultati, troubleshooting.',
  openGraph: {
    title: 'Guide e Supporto | Stress Index',
    description:
      'Come usare Stress Index: connessione sensori, tipi di test HRV, leggere i risultati, troubleshooting.',
    url: 'https://stressindex.io/guide',
    siteName: 'Stress Index',
    locale: 'it_IT',
    type: 'website',
  },
  alternates: {
    canonical: 'https://stressindex.io/guide',
  },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'L\'app si è chiusa durante la misurazione',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Se la misurazione era in corso da meno di 1 minuto i dati sono persi. Se era in corso da più di 1 minuto l\'app potrebbe aver salvato i dati automaticamente. Riapri l\'app e controlla lo storico del cliente. Su Android vai in Impostazioni, App, Stress Index, Batteria, Nessuna restrizione.',
      },
    },
    {
      '@type': 'Question',
      name: 'I valori sembrano strani',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Verifica che la fascia fosse ben posizionata e bagnata. Controlla l\'artifact rate, se è sopra il 5% la misurazione potrebbe non essere affidabile. Il cliente si è mosso o ha parlato durante la misurazione? Il movimento crea artefatti.',
      },
    },
    {
      '@type': 'Question',
      name: 'Non riesco a vedere i dati sulla dashboard web',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Verifica di essere loggato con lo stesso account su app e web (stressindex.io/area-professionisti). I dati si sincronizzano automaticamente, ma serve connessione internet. Se i dati non appaiono, chiudi e riapri l\'app con internet attivo per forzare il sync.',
      },
    },
    {
      '@type': 'Question',
      name: 'Il PDF non si genera',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Verifica che la misurazione sia completa, non interrotta. Prova a chiudere e riaprire i risultati. Se persiste, contattaci a support@stressindex.io.',
      },
    },
    {
      '@type': 'Question',
      name: 'Come resetto la password?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Nella schermata di login tappa "Password dimenticata", inserisci la tua email e segui le istruzioni.',
      },
    },
  ],
}

export default function GuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <GuideClient />
    </>
  )
}
