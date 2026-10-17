// Test della regola di accoppiamento "prima e dopo" (porting dell'app).
// Si esegue con `npm test` (node --test, senza dipendenze aggiuntive).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deltaVerdict, normalizeTagKey, pairBeforeAfter, pairMorningCoherence, tagCounts, type PairableRow } from './before-after.ts'

function row(id: string, day: number, hour: number, tags: string[], clientId: string | null = 'c1', minute = 0): PairableRow {
  const d = Date.UTC(2026, 8, day, hour, minute)
  return { id, clientId, instantMs: d, dayKey: `2026-09-${String(day).padStart(2, '0')}`, tags }
}

test('accoppia una pre e una post sessione dello stesso giorno', () => {
  const pairs = pairBeforeAfter([row('a', 1, 9, ['pre_session']), row('b', 1, 10, ['post_session'])])
  assert.equal(pairs.length, 1)
  assert.equal(pairs[0].pre.id, 'a')
  assert.equal(pairs[0].post.id, 'b')
  assert.equal(pairs[0].kind, 'treatment')
})

test('pre e post allenamento si accoppiano fra loro, mai con il trattamento', () => {
  const pairs = pairBeforeAfter([
    row('a', 1, 9, ['pre_workout']),
    row('b', 1, 10, ['post_session']),
    row('c', 1, 11, ['post_workout']),
  ])
  assert.equal(pairs.length, 1)
  assert.equal(pairs[0].pre.id, 'a')
  assert.equal(pairs[0].post.id, 'c')
  assert.equal(pairs[0].kind, 'workout')
})

test('giorni diversi o clienti diversi non fanno coppia', () => {
  assert.equal(pairBeforeAfter([row('a', 1, 9, ['pre_session']), row('b', 2, 10, ['post_session'])]).length, 0)
  assert.equal(pairBeforeAfter([row('a', 1, 9, ['pre_session'], 'c1'), row('b', 1, 10, ['post_session'], 'c2')]).length, 0)
})

test('la post deve venire dopo la pre', () => {
  assert.equal(pairBeforeAfter([row('a', 1, 11, ['pre_session']), row('b', 1, 10, ['post_session'])]).length, 0)
})

test('con più pre e post ogni post prende il pre precedente più vicino', () => {
  const pairs = pairBeforeAfter([
    row('pre1', 1, 9, ['pre_session']),
    row('post1', 1, 9, ['post_session'], 'c1', 45),
    row('pre2', 1, 15, ['pre_session']),
    row('post2', 1, 15, ['post_session'], 'c1', 50),
  ])
  assert.equal(pairs.length, 2)
  // Dalla più recente.
  assert.deepEqual([pairs[0].pre.id, pairs[0].post.id], ['pre2', 'post2'])
  assert.deepEqual([pairs[1].pre.id, pairs[1].post.id], ['pre1', 'post1'])
})

test('due post dopo lo stesso pre danno due coppie con lo stesso pre', () => {
  const pairs = pairBeforeAfter([
    row('pre', 1, 9, ['pre_session']),
    row('post1', 1, 10, ['post_session']),
    row('post2', 1, 11, ['post_session']),
  ])
  assert.equal(pairs.length, 2)
  assert.ok(pairs.every((p) => p.pre.id === 'pre'))
})

test('riconosce le etichette italiane e inglesi salvate prima delle chiavi neutre', () => {
  assert.equal(normalizeTagKey('Pre trattamento'), 'pre_session')
  assert.equal(normalizeTagKey('after workout'), 'post_workout')
  assert.equal(normalizeTagKey('mio tag'), 'mio tag')
  const pairs = pairBeforeAfter([row('a', 1, 9, ['Pre trattamento']), row('b', 1, 10, ['post trattamento'])])
  assert.equal(pairs.length, 1)
})

test('una sessione con entrambe le etichette non si accoppia con se stessa', () => {
  assert.equal(pairBeforeAfter([row('a', 1, 9, ['pre_session', 'post_session'])]).length, 0)
})

test('tagCounts conta per chiave neutra, preset prima, una volta per riga', () => {
  const counts = tagCounts([
    { tags: ['morning', 'Misurazione mattutina'] },
    { tags: ['zeta', 'pre_session'] },
    { tags: ['alfa'] },
  ])
  assert.deepEqual(Array.from(counts.entries()), [['morning', 1], ['pre_session', 1], ['alfa', 1], ['zeta', 1]])
})

test('deltaVerdict: per lo Stress il calo è un miglioramento', () => {
  assert.equal(deltaVerdict(70, 55, false), 'improved')
  assert.equal(deltaVerdict(55, 70, false), 'declined')
  assert.equal(deltaVerdict(50, 52, true), 'stable')
  assert.equal(deltaVerdict(null, 52, true), 'unknown')
})

// ── Mattino + coerenza (solo sito, non nel Dart) ─────────────────────────────

function mc(id: string, day: number, hour: number, minute: number, kind: 'reference' | 'coherence' | 'other') {
  return { ...row(id, day, hour, [], 'c1', minute), reference: kind === 'reference', coherence: kind === 'coherence' }
}

test('mattino + coerenza: la riferimento del mattino con la coerenza dello stesso giorno che la segue (Sara 16 e 17/10)', () => {
  const pairs = pairMorningCoherence([
    mc('m16', 16, 6, 59, 'reference'), mc('c16', 16, 7, 25, 'coherence'),
    mc('m17', 17, 6, 55, 'reference'), mc('c17', 17, 10, 39, 'coherence'),
    mc('m15', 15, 7, 32, 'reference'),
  ])
  assert.equal(pairs.length, 2)
  assert.equal(pairs[0].morning.id, 'm17')
  assert.equal(pairs[0].coherence.id, 'c17')
  assert.equal(pairs[1].morning.id, 'm16')
  assert.equal(pairs[1].coherence.id, 'c16')
})

test('mattino + coerenza: niente coppia senza riferimento, se la coerenza viene prima, o in giorni diversi', () => {
  assert.equal(pairMorningCoherence([mc('c', 16, 7, 25, 'coherence')]).length, 0)
  assert.equal(pairMorningCoherence([mc('c', 16, 6, 0, 'coherence'), mc('m', 16, 7, 0, 'reference')]).length, 0)
  assert.equal(pairMorningCoherence([mc('m', 15, 7, 0, 'reference'), mc('c', 16, 7, 25, 'coherence')]).length, 0)
  // Una misurazione pomeridiana (non di riferimento) non fa da mattino.
  assert.equal(pairMorningCoherence([mc('p', 16, 15, 0, 'other'), mc('c', 16, 16, 0, 'coherence')]).length, 0)
})

test('mattino + coerenza: con due mattine la coerenza prende la più vicina, due coerenze danno due coppie', () => {
  const pairs = pairMorningCoherence([
    mc('m1', 3, 7, 9, 'reference'), mc('m2', 3, 7, 38, 'reference'),
    mc('c1', 3, 8, 0, 'coherence'), mc('c2', 3, 11, 0, 'coherence'),
  ])
  assert.equal(pairs.length, 2)
  assert.equal(pairs[0].coherence.id, 'c2')
  assert.equal(pairs[0].morning.id, 'm2')
  assert.equal(pairs[1].morning.id, 'm2')
})
