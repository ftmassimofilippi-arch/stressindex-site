// Le letture pure del Biofeedback (src/lib/biofeedback.ts): coercizione,
// calendario dei percorsi identico al Dart, aderenza, celle, media mobile,
// confronto fra periodi, asse adattivo, guida contro il limite.
// Si esegue con `npm test` (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PERCORSI,
  aderenzaPerSettimana,
  asseAdattivo,
  celleCalendario,
  chiaveGiorno,
  confrontoPeriodi,
  giorniFra,
  guidaControIlLimite,
  lunediDi,
  mediaMobile,
  minutiSintonia,
  parseBiofeedbackAssignment,
  parseBiofeedbackSession,
  parseResonanceAssessment,
  piuGiorni,
  settimanaDelPercorso,
  type BiofeedbackSession,
} from './biofeedback.ts'

function sessione(id: string, iniziata: string, extra: Partial<BiofeedbackSession> = {}): BiofeedbackSession {
  return {
    id,
    user_id: 'cli',
    client_id: 'scheda',
    professional_id: 'pro',
    assegnazione_id: 'a1',
    iniziata_il: iniziata,
    tz_offset_minutes: 120,
    durata_s: 600,
    durata_prevista_s: 600,
    ritmo_assegnato: 6,
    ritmo_finale: 6,
    ritmo_migliore: 6,
    inspira_frazione: 0.5,
    sfida: 1,
    secondi_livello: { 1: 60, 2: 120, 3: 240 },
    secondi_pausa: 0,
    secondi_attesa: 60,
    aggancio_s: 95,
    serie: [],
    cambi_ritmo: [],
    umore_dopo: 4,
    battiti: 600,
    artefatti: 3,
    algorithm_version: 'biofeedback-1.1.0',
    completata: true,
    ...extra,
  }
}

test('coercizione delle righe: numeri come stringhe, jsonb, mancanze', () => {
  const s = parseBiofeedbackSession({
    id: 's1', user_id: 'u', iniziata_il: '2026-10-20T07:00:00Z', tz_offset_minutes: '120',
    durata_s: '600', durata_prevista_s: 600, ritmo_assegnato: '6.00', ritmo_finale: 5.8, ritmo_migliore: 5.8,
    secondi_livello: { '1': 10, '3': '200' }, serie: [{ s: 5, stato: 'attivo', livello: 2, score: '1.1', artefatti_pct: 0 }],
    cambi_ritmo: [{ s: 90, da: 6, a: 5.8, motivo: 'esploraScelta' }], completata: 'no',
  })
  assert.ok(s)
  assert.equal(s!.tz_offset_minutes, 120)
  assert.equal(s!.secondi_livello[2], 0)
  assert.equal(s!.secondi_livello[3], 200)
  assert.equal(s!.serie[0].score, 1.1)
  assert.equal(s!.cambi_ritmo[0].motivo, 'esploraScelta')
  assert.equal(s!.completata, true) // valore non booleano: default
  assert.equal(parseBiofeedbackSession({ id: 'x' }), null)

  const a = parseBiofeedbackAssignment({ id: 'a', professional_id: 'p', client_user_id: 'c', percorso: 'boh', ritmo: '5.5', inizio: '2026-10-12T00:00:00', stato: 'sospeso' })
  assert.equal(a!.percorso, 'pratica_libera')
  assert.equal(a!.inizio, '2026-10-12')
  assert.equal(a!.stato, 'sospeso')

  const v = parseResonanceAssessment({ id: 'v', user_id: 'u', iniziata_il: '2026-10-20T07:00:00Z', esito: { ritmi: [{ ritmo: 6, battiti: 90 }], voti: { fase: 5.5, sdnn: null }, voti_validi: 5, ritmo_suggerito: 5.5 }, confidenza: '0.8' })
  assert.equal(v!.ritmo_suggerito, 5.5)
  assert.equal(v!.confidenza, 0.8)
  assert.equal(v!.voti.fase, 5.5)
  assert.equal(v!.ritmi[0].battiti, 90)
})

test('giorno locale, giorni di calendario, lunedì (immune all\'ora legale)', () => {
  // 23:30 UTC del 19/10 con fuso +120 → giorno locale 20/10.
  assert.equal(chiaveGiorno({ iniziata_il: '2026-10-19T23:30:00Z', tz_offset_minutes: 120 }), '2026-10-20')
  assert.equal(giorniFra('2026-10-05', '2026-11-30'), 56)
  assert.equal(piuGiorni('2026-10-05', 56), '2026-11-30')
  assert.equal(lunediDi('2026-10-15'), '2026-10-12')
  assert.equal(lunediDi('2026-10-12'), '2026-10-12')
  assert.equal(settimanaDelPercorso('2026-10-05', '2026-11-30'), 9)
})

test('calendario dei percorsi: lo stesso del Dart', () => {
  const f = PERCORSI.fondamenti
  assert.equal(f.settimane, 8)
  assert.deepEqual(f.fasi.map((x) => [x.sessioniGiorno, x.minutiSessione, x.sfida]), [[1, 5, 1], [1, 10, 2], [2, 10, 2], [2, 20, 3]])
  assert.equal(PERCORSI.ripresa_veloce.settimane, 4)
  assert.equal(PERCORSI.pratica_libera.settimane, 0)
})

test('aderenza per settimana: attese fino a oggi, solo sessioni del percorso lunghe almeno un minuto', () => {
  const a = parseBiofeedbackAssignment({ id: 'a1', professional_id: 'pro', client_user_id: 'cli', percorso: 'fondamenti', ritmo: 6, inizio: '2026-10-12' })!
  const sessioni = [
    sessione('s1', '2026-10-12T07:00:00Z'),
    sessione('s2', '2026-10-13T07:00:00Z'),
    sessione('s3', '2026-10-13T18:00:00Z', { durata_s: 30 }), // troppo corta
    sessione('s4', '2026-10-19T07:00:00Z'),
    sessione('s5', '2026-10-19T09:00:00Z', { assegnazione_id: null }), // pratica libera
  ]
  const ad = aderenzaPerSettimana(a, sessioni, '2026-10-20')
  assert.equal(ad.length, 2)
  assert.deepEqual([ad[0].fatte, ad[0].attese], [2, 7])
  assert.deepEqual([ad[1].fatte, ad[1].attese], [1, 2])
  assert.equal(ad[1].minutiSintonia, 4)
  assert.deepEqual(aderenzaPerSettimana(a, sessioni, '2026-10-11'), [])
  // Oltre la fine del percorso le settimane si fermano a 8.
  assert.equal(aderenzaPerSettimana(a, sessioni, '2027-01-01').length, 8)
})

test('celle del calendario: otto settimane fino a quella di oggi', () => {
  const celle = celleCalendario([sessione('s1', '2026-10-19T07:00:00Z'), sessione('s2', '2026-10-19T17:00:00Z')], '2026-10-20')
  assert.equal(celle.length, 56)
  assert.equal(celle[0].giorno, '2026-08-31')
  assert.equal(celle[55].giorno, '2026-10-25')
  const c = celle.find((x) => x.giorno === '2026-10-19')!
  assert.deepEqual([c.sessioni, c.minuti, c.minutiSintonia], [2, 20, 8])
})

test('media mobile e asse adattivo', () => {
  assert.deepEqual(mediaMobile([1, 2, 3, 4, 5], 3), [1.5, 2, 3, 4, 4.5])
  assert.deepEqual(mediaMobile([1, null, 3], 3), [1, 2, 3])
  assert.deepEqual(asseAdattivo([2, 4, 6]), [0, 6.6])
  assert.deepEqual(asseAdattivo([]), [0, 1])
  assert.deepEqual(asseAdattivo([5, 5]), [0, 5.5])
  assert.deepEqual(asseAdattivo([40, 60], { daZero: false }), [38, 62.2])
})

test('confronto fra periodi: ultime due settimane contro le due prima, in percentuale', () => {
  const s = [
    sessione('a', '2026-10-19T07:00:00Z', { secondi_livello: { 1: 0, 2: 0, 3: 360 } }),
    sessione('b', '2026-10-12T07:00:00Z', { secondi_livello: { 1: 0, 2: 0, 3: 240 } }),
    sessione('c', '2026-10-01T07:00:00Z', { secondi_livello: { 1: 0, 2: 0, 3: 120 } }),
    sessione('d', '2026-09-28T07:00:00Z', { secondi_livello: { 1: 0, 2: 0, 3: 180 } }),
    sessione('e', '2026-08-01T07:00:00Z', { secondi_livello: { 1: 0, 2: 0, 3: 600 } }), // fuori
  ]
  const c = confrontoPeriodi(s, minutiSintonia, '2026-10-20')
  assert.equal(c.recente, 5)
  assert.equal(c.precedente, 2.5)
  assert.equal(c.deltaPct, 100)
  assert.deepEqual([c.sessioniRecenti, c.sessioniPrecedenti], [2, 2])
  const vuoto = confrontoPeriodi(s.slice(0, 2), minutiSintonia, '2026-10-20')
  assert.equal(vuoto.deltaPct, null)
})

test('guida contro il limite: quattro delle ultime cinque sessioni sullo stesso bordo', () => {
  const su = (id: string, g: string) => sessione(id, g, { ritmo_assegnato: 6, ritmo_finale: 6.5 })
  const ok = (id: string, g: string) => sessione(id, g, { ritmo_assegnato: 6, ritmo_finale: 6.1 })
  assert.deepEqual(
    guidaControIlLimite([su('1', '2026-10-01T07:00:00Z'), su('2', '2026-10-02T07:00:00Z'), ok('3', '2026-10-03T07:00:00Z'), su('4', '2026-10-04T07:00:00Z'), su('5', '2026-10-05T07:00:00Z')]),
    { verso: 'su', sessioni: 4 },
  )
  assert.equal(guidaControIlLimite([su('1', '2026-10-01T07:00:00Z'), su('2', '2026-10-02T07:00:00Z'), ok('3', '2026-10-03T07:00:00Z')]), null)
  // Le sessioni vecchie oltre le ultime cinque non contano.
  assert.equal(
    guidaControIlLimite([su('0', '2026-09-01T07:00:00Z'), su('1', '2026-10-01T07:00:00Z'), ok('2', '2026-10-02T07:00:00Z'), ok('3', '2026-10-03T07:00:00Z'), su('4', '2026-10-04T07:00:00Z'), su('5', '2026-10-05T07:00:00Z')]),
    null,
  )
})
