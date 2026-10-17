// Dati societari del titolare del sito e del servizio: UNICA fonte per il
// footer (`src/components/LegalFooter.tsx`), le pagine legali e qualunque altro
// punto che debba citare la ragione sociale. Si aggiornano SOLO qui.
//
// `rea` e `shareCapital` (art. 2250 c.c.) sono ancora da fornire: finché sono
// null il footer non li mostra. Mai un segnaposto visibile in produzione.
export const COMPANY = {
  legalName: 'The Performance Lab S.r.l.',
  address: 'Via Francesco Baracca 88, 36100 Vicenza (VI), Italia',
  vat: '04323080244',
  taxCode: '04323080244',
  pec: 'theperformancelab@pec.it',
  rea: null as string | null,
  shareCapital: null as string | null,
  court: 'Padova',
  email: 'support@stressindex.io',
  privacyEmail: 'privacy@stressindex.io',
} as const

export type Company = typeof COMPANY

// Versione del pacchetto legale in vigore: la riaccettazione scatta per chi non
// ha consensi con questa versione (`src/lib/consents.ts`).
export const LEGAL_VERSION = '2.1'
