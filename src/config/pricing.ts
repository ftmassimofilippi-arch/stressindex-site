// Listino ufficiale (EUR al mese, IVA esclusa salvo diversa indicazione). Unica fonte per sito e i18n.
// I testi nei frammenti messages/_parts ricevono i valori via parametro ({price}, {base},
// {standard}, {seats}): nessun prezzo va scritto a mano nelle stringhe.
export const PRICING = {
  base: 69.9,            // Piano Base
  founding: 49.9,        // Founding Members, primi 200 iscritti, prezzo bloccato
  foundingSeats: 200,
  pro: 99,               // Piano Pro = Base + Modulo Sport
  trialDays: 60,
  competitors: { kubiosYear: 750, hrv4TrainingMonth: 10 },
} as const
