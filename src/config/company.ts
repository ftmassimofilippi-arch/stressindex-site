// Dati societari del titolare del sito e del servizio: UNICA fonte per il
// footer (`src/components/LegalFooter.tsx`), le pagine legali e qualunque altro
// punto che debba citare la ragione sociale.
//
// Indirizzo e partita IVA non sono ancora noti: restano segnaposto espliciti
// e si aggiornano SOLO qui quando il legale li conferma. Lo stesso vale per
// le pagine /privacy, /termini e /cookie, che leggono `legalName` ed `email`
// da questo oggetto nei testi che li citano via interpolazione.
export const COMPANY = {
  legalName: 'The Performance Lab S.r.l.',
  address: '[DA COMPLETARE]',
  vat: '[DA COMPLETARE]',
  email: 'support@stressindex.io',
} as const

export type Company = typeof COMPANY
