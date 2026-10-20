// Test della regola oraria delle misurazioni (src/lib/measured-time.ts): da
// quale colonna si prende l'istante e dove cadono i confini di giornata
// italiana.
// Si esegue con `npm test` (node --test, senza dipendenze aggiuntive).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  conIstanteSessione,
  fineGiornoIta,
  inizioGiornoIta,
  intervalloGiorniIta,
  measuredDayKey,
  measuredInstant,
  mezzogiornoIta,
  type ConIstante,
} from './measured-time.ts'
import { capitalizeFirst, displayName } from './text-case.ts'

// Ora sull'orologio italiano, come la mostra `formatMeasuredTime` di format.ts
// (che aggiunge solo la lingua e non è importabile qui per via degli alias).
function oraItaliana(row: ConIstante): string {
  const i = measuredInstant(row)
  if (!i) return '—'
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(i)
}

// Caso reale che ha aperto la segnalazione: la sessione 1790781395355 del
// 30 settembre 2026. started_at_utc dice 15:16 UTC (17:16 italiane),
// started_at porta la forma legacy 17:16 etichettata UTC.
const SESSIONE = {
  started_at: '2026-09-30T17:16:35.355619+00:00',
  started_at_utc: '2026-09-30T15:16:35.355619+00:00',
  tz_offset_minutes: 120,
}

test('vince started_at_utc anche quando tz_offset_minutes è valorizzato', () => {
  const i = measuredInstant(SESSIONE)
  assert.equal(i?.toISOString(), '2026-09-30T15:16:35.355Z')
  assert.equal(oraItaliana(SESSIONE), '17:16')
})

test('senza colonna _utc il valore grezzo è la forma legacy, non un istante', () => {
  // tz_offset_minutes valorizzato NON significa "già UTC": su `sessions` il
  // trigger riscrive sempre started_at nella forma legacy.
  const i = measuredInstant({ started_at: SESSIONE.started_at, tz_offset_minutes: 120 })
  assert.equal(i?.toISOString(), '2026-09-30T15:16:35.355Z')
})

test('la sessione batte measured_at_utc sulla riga unita', () => {
  // measurement_analytics.measured_at_utc è sbagliata su parte dello storico:
  // qui riporta la forma legacy come se fosse un istante.
  const analytics = {
    measured_at: '2026-09-30T17:16:35.355619+00:00',
    measured_at_utc: '2026-09-30T17:16:35.355619+00:00',
    tz_offset_minutes: 120,
  }
  assert.equal(measuredInstant(analytics)?.toISOString(), '2026-09-30T17:16:35.355Z')
  const unita = conIstanteSessione(analytics, SESSIONE)
  assert.equal(measuredInstant(unita)?.toISOString(), '2026-09-30T15:16:35.355Z')
  assert.equal(oraItaliana(unita), '17:16')
})

test('conIstanteSessione lascia la riga intatta se la sessione non porta l istante', () => {
  const analytics = { measured_at: '2026-09-30T17:16:35.000Z', measured_at_utc: '2026-09-30T15:16:35.000Z' }
  assert.deepEqual(conIstanteSessione(analytics, null), analytics)
  assert.deepEqual(conIstanteSessione(analytics, { started_at_utc: null }), analytics)
})

test('il giorno di una misurazione serale è quello italiano, non quello UTC', () => {
  // 30 settembre 22:30 italiane = 20:30 UTC: stesso giorno.
  assert.equal(measuredDayKey({ started_at_utc: '2026-09-30T20:30:00.000Z' }), '2026-09-30')
  // 30 settembre 23:30 italiane = 21:30 UTC: ancora il 30, non il primo ottobre.
  assert.equal(measuredDayKey({ started_at_utc: '2026-09-30T21:30:00.000Z' }), '2026-09-30')
  // 1 ottobre 00:30 italiane = 30 settembre 22:30 UTC: è già il primo ottobre.
  assert.equal(measuredDayKey({ started_at_utc: '2026-09-30T22:30:00.000Z' }), '2026-10-01')
})

test('i confini di giornata cadono a mezzanotte italiana, ora legale inclusa', () => {
  // Ora legale (CEST, +2).
  assert.equal(inizioGiornoIta('2026-09-30'), '2026-09-29T22:00:00.000Z')
  assert.equal(fineGiornoIta('2026-09-30'), '2026-09-30T21:59:59.999Z')
  // Ora solare (CET, +1).
  assert.equal(inizioGiornoIta('2026-01-15'), '2026-01-14T23:00:00.000Z')
  assert.equal(fineGiornoIta('2026-01-15'), '2026-01-15T22:59:59.999Z')
})

test('un intervallo di giorni copre tutte le misurazioni dei giorni estremi', () => {
  const { fromIso, toIso } = intervalloGiorniIta('2026-09-01', '2026-09-30')
  const primaDelPeriodo = new Date('2026-08-31T21:59:00.000Z') // 31 agosto 23:59 italiane
  const seraDelPrimo = new Date('2026-09-01T22:30:00.000Z') // 2 settembre 00:30 italiane
  const seraDellUltimo = new Date('2026-09-30T21:30:00.000Z') // 30 settembre 23:30 italiane
  assert.ok(primaDelPeriodo < new Date(fromIso))
  assert.ok(seraDelPrimo > new Date(fromIso) && seraDelPrimo < new Date(toIso))
  assert.ok(seraDellUltimo < new Date(toIso))
})

test('una riga senza timestamp non produce un istante', () => {
  assert.equal(measuredInstant(null), null)
  assert.equal(measuredInstant({}), null)
  assert.equal(measuredDayKey(undefined), null)
})

// Caso del 20/10/2026 (idratazione): una chiave di giornata formattata con la
// mezzanotte LOCALE cade nel giorno prima in un browser a est di Roma, mentre
// il server di Vercel (UTC) scrive il giorno giusto. `mezzogiornoIta` dà lo
// stesso giorno italiano qualunque sia il fuso di chi esegue.
test('mezzogiornoIta: lo stesso giorno italiano da Bangkok, Los Angeles e UTC', () => {
  const giorno = (d: Date) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: 'short', year: 'numeric' }).format(d)
  const tzPrima = process.env.TZ
  try {
    for (const tz of ['Asia/Bangkok', 'America/Los_Angeles', 'UTC', 'Europe/Rome']) {
      process.env.TZ = tz
      assert.equal(giorno(mezzogiornoIta('2026-06-10')), '10 giu 2026', tz)
      assert.equal(giorno(mezzogiornoIta('2026-01-01')), '01 gen 2026', tz)
      // Il vecchio modo (mezzanotte locale) sbagliava davvero a est di Roma.
      if (tz === 'Asia/Bangkok') assert.equal(giorno(new Date(2026, 5, 10)), '09 giu 2026')
    }
  } finally {
    if (tzPrima === undefined) delete process.env.TZ
    else process.env.TZ = tzPrima
  }
})

// ── Normalizzazioni di testo (src/lib/text-case.ts) ─────────────────────────
// `fullName` e `todayLong` di format.ts passano da qui; format.ts stesso non è
// importabile nei test per via degli alias `@/`.

test('todayLong: solo la prima lettera maiuscola, mese minuscolo in italiano', () => {
  const it = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(2026, 9, 14))
  assert.equal(capitalizeFirst(it), 'Mercoledì 14 ottobre 2026')
  assert.equal(capitalizeFirst('Wednesday, October 14, 2026'), 'Wednesday, October 14, 2026')
  assert.equal(capitalizeFirst(''), '')
})

test('displayName: le parole tutte maiuscole passano in Title Case', () => {
  assert.equal(displayName('NICOLÒ DONATINI'), 'Nicolò Donatini')
  assert.equal(displayName("D'ANGELO"), "D'Angelo")
  assert.equal(displayName("DELL’ORTO"), "Dell’Orto")
  assert.equal(displayName('MARIA-LUISA ROSSI'), 'Maria-Luisa Rossi')
})

test('displayName: parole già miste, sigle corte e particelle restano intatte', () => {
  assert.equal(displayName('Doretta Sabbatini'), 'Doretta Sabbatini')
  assert.equal(displayName('Ronald McDonald'), 'Ronald McDonald')
  assert.equal(displayName('DJ Francesco'), 'DJ Francesco')
  assert.equal(displayName('Luca de ROSSI'), 'Luca de Rossi')
  assert.equal(displayName('J.R. SMITH'), 'J.R. Smith')
  assert.equal(displayName(''), '')
  assert.equal(displayName(null), '')
})
