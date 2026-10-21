// Le letture pure del Breathwork (src/lib/breathwork.ts): coercizione,
// calendario identico al Dart (occorrenze previste, periodo, aderenza per
// settimana e ultime quattro, fuori calendario, percorso Biofeedback),
// nome dell'esercizio per lingua. Si esegue con `npm test` (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aderenza4Settimane,
  aderenzaPerSettimane,
  aderenzaSettimana,
  fineEffettiva,
  giornoSettimana,
  nomeEsercizio,
  occorrenzePreviste,
  parseAttivita,
  parseBreathworkSession,
  parseCompletamento,
  parseEsercizio,
  type AttivitaProgramma,
  type Completamento,
} from './breathwork.ts'

function att(extra: Partial<AttivitaProgramma> = {}): AttivitaProgramma {
  return {
    id: 'a1',
    professional_id: 'pro',
    client_user_id: 'cli',
    client_id: 'scheda',
    tipo: 'esercizio_respiro',
    riferimento: 'lib_a',
    parametri: {},
    calendario: { giorni: [1, 2, 3, 4, 5, 6, 7], volte_giorno: 2, orari: ['08:00', '20:00'] },
    inizio: '2026-10-12',
    fine: null,
    settimane: null,
    stato: 'attivo',
    nota_cliente: null,
    created_at: null,
    ...extra,
  }
}

function fatto(giorno: string, fascia = 0, attivita = 'a1'): Completamento {
  return { id: `${attivita}-${giorno}-${fascia}`, attivita_id: attivita, user_id: 'cli', giorno, fascia, fatto_il: `${giorno}T08:00:00Z`, modo: 'automatico', sessione_tipo: null, sessione_id: null, nota: null }
}

test('parseAttivita: coercizione, tipo sconosciuto scartato, orari in ordine', () => {
  const a = parseAttivita({
    id: 'a1', professional_id: 'pro', client_user_id: 'cli', tipo: 'esercizio_respiro', riferimento: 'lib_a',
    parametri: { minuti: 5 }, calendario: { giorni: [5, 1, 3], volte_giorno: '2', orari: ['20:00:00', '08:00'] },
    inizio: '2026-10-12', settimane: '4', stato: 'sospeso',
  })
  assert.ok(a)
  assert.deepEqual(a.calendario, { giorni: [5, 1, 3], volte_giorno: 2, orari: ['08:00', '20:00'] })
  assert.equal(a.settimane, 4)
  assert.equal(a.stato, 'sospeso')
  assert.equal(parseAttivita({ id: 'x', professional_id: 'p', client_user_id: 'c', tipo: 'sonno', inizio: '2026-10-12' }), null)
})

test('periodo e fine dalle settimane; giorno della settimana', () => {
  const a = att({ settimane: 2 })
  assert.equal(fineEffettiva(a), '2026-10-25')
  assert.equal(occorrenzePreviste(a, '2026-10-11'), 0)
  assert.equal(occorrenzePreviste(a, '2026-10-25'), 2)
  assert.equal(occorrenzePreviste(a, '2026-10-26'), 0)
  assert.equal(giornoSettimana('2026-10-12'), 1) // lunedì
  assert.equal(giornoSettimana('2026-10-18'), 7)
  assert.equal(occorrenzePreviste(att({ calendario: { giorni: [1, 3, 5], volte_giorno: 1, orari: [] } }), '2026-10-13'), 0)
  assert.equal(occorrenzePreviste(att({ stato: 'sospeso' }), '2026-10-14'), 0)
})

test('il percorso Biofeedback prende le volte dal percorso', () => {
  const a = att({ tipo: 'biofeedback_percorso', riferimento: 'fondamenti', calendario: { giorni: [1, 2, 3, 4, 5, 6, 7], volte_giorno: null, orari: ['08:30'] }, settimane: 8 })
  assert.equal(occorrenzePreviste(a, '2026-10-14'), 1)
  assert.equal(occorrenzePreviste(a, '2026-11-10'), 2)
  assert.equal(occorrenzePreviste(a, '2026-12-10'), 0)
})

test('aderenza della settimana conta fino a oggi, mai oltre il previsto, fuori calendario conta', () => {
  const a = att({ calendario: { giorni: [1, 3, 5], volte_giorno: 1, orari: ['08:00'] } })
  const c = [fatto('2026-10-12'), fatto('2026-10-12', 1), fatto('2026-10-13')]
  const ad = aderenzaSettimana(a, c, '2026-10-16')
  assert.deepEqual(ad, { fatte: 2, previste: 3, quota: 2 / 3 })
  const settimane = aderenzaPerSettimane(a, c, '2026-10-16', 2)
  assert.equal(settimane.length, 2)
  assert.equal(settimane[0].lunedi, '2026-10-05')
  assert.deepEqual(settimane[0].aderenza, { fatte: 0, previste: 0, quota: 0 })
  assert.equal(settimane[1].lunedi, '2026-10-12')
})

test('ultime quattro settimane; una sospesa oggi tiene il passato', () => {
  const a = att({ calendario: { giorni: [1, 2, 3, 4, 5, 6, 7], volte_giorno: 1, orari: ['08:00'] }, inizio: '2026-09-01' })
  const c = Array.from({ length: 10 }, (_, i) => fatto(`2026-10-${String(1 + i).padStart(2, '0')}`))
  const ad = aderenza4Settimane(a, c, '2026-10-14')
  assert.equal(ad.previste, 24)
  assert.equal(ad.fatte, 10)
  const sosp = aderenza4Settimane({ ...a, stato: 'sospeso' }, c, '2026-10-14')
  assert.equal(sosp.previste, 24)
})

test('parseCompletamento, parseBreathworkSession, parseEsercizio e nome per lingua', () => {
  const c = parseCompletamento({ id: 'c1', attivita_id: 'a1', user_id: 'cli', giorno: '2026-10-14', fascia: '1', fatto_il: '2026-10-14T08:00:00Z', modo: 'manuale', sessione_tipo: 'hrv', sessione_id: 's' })
  assert.ok(c)
  assert.equal(c.fascia, 1)
  assert.equal(c.modo, 'manuale')
  assert.equal(c.sessione_tipo, 'hrv')
  const s = parseBreathworkSession({ id: 's1', user_id: 'cli', iniziata_il: '2026-10-14T08:00:00Z', tz_offset_minutes: 120, durata_s: '300', durata_prevista_s: null, con_sensore: true, fc_media: '62.5', rmssd_ms: 45, serie_fc: [{ s: 5, bpm: 64 }], esercizio_nome: 'Box' })
  assert.ok(s)
  assert.equal(s.durata_prevista_s, null)
  assert.equal(s.fc_media, 62.5)
  assert.equal(s.serie_fc[0].bpm, 64)
  assert.equal(s.completata, true)
  const e = parseEsercizio({ id: 'lib_a', owner_id: null, categoria: 'calma', lingua: 'it', testi: { it: { nome: 'Coerenza' }, en: { nome: 'Coherent' } }, durata_modo: 'minuti', durata_valore: 10 })
  assert.ok(e)
  assert.equal(nomeEsercizio(e, 'en'), 'Coherent')
  assert.equal(nomeEsercizio(e, 'de'), 'Coerenza')
})
