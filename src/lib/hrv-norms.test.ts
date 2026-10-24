// Test di src/lib/hrv-norms.ts (npm test). Le fasce devono restare identiche a
// `public.hrv_age_group` e a DemographicProfile.fromFields dell'app.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hrvAgeGroup, normFitness, normProfileFromClient, normSex, rangesFromNormRows } from './hrv-norms.ts'

test('hrvAgeGroup come la funzione SQL', () => {
  assert.equal(hrvAgeGroup(null), null)
  assert.equal(hrvAgeGroup(18), 'young')
  assert.equal(hrvAgeGroup(30), 'young')
  assert.equal(hrvAgeGroup(31), 'midAdult')
  assert.equal(hrvAgeGroup(45), 'midAdult')
  assert.equal(hrvAgeGroup(46), 'senior')
  assert.equal(hrvAgeGroup(60), 'senior')
  assert.equal(hrvAgeGroup(61), 'elderly')
  assert.equal(hrvAgeGroup(90), 'elderly')
})

test('sesso: solo M e F', () => {
  assert.equal(normSex('M'), 'male')
  assert.equal(normSex('F'), 'female')
  assert.equal(normSex('X'), null)
  assert.equal(normSex(null), null)
})

test('livello di attività come l app', () => {
  assert.equal(normFitness(true, 'sedentario'), 'athlete')
  assert.equal(normFitness(false, 'atleta'), 'athlete')
  assert.equal(normFitness(null, 'attivo'), 'active')
  assert.equal(normFitness(false, 'moderato'), 'active')
  assert.equal(normFitness(false, 'sedentario'), 'sedentary')
  assert.equal(normFitness(null, null), 'sedentary')
  assert.equal(normFitness(false, 'alto'), 'sedentary')
})

test('profilo: Doretta (sesso nullo, 65 anni) resta sui range generici', () => {
  const r = normProfileFromClient({ sesso: null, atleta: false, livello_attivita: 'sedentario' }, 65)
  assert.deepEqual(r, { ok: false, missing: ['sex'], sexOther: false })
})

test('profilo: mancano entrambi, o sesso X', () => {
  assert.deepEqual(normProfileFromClient({}, null), { ok: false, missing: ['sex', 'birthDate'], sexOther: false })
  assert.deepEqual(normProfileFromClient({ sesso: 'X' }, 40), { ok: false, missing: [], sexOther: true })
})

test('profilo completo', () => {
  const r = normProfileFromClient({ sesso: 'F', atleta: false, livello_attivita: 'moderato' }, 64)
  assert.deepEqual(r, { ok: true, profile: { sex: 'female', ageGroup: 'elderly', fitness: 'active' } })
})

// Dal 23/10/2026 (DECISIONI.md, decisioni 1, 3, 4, 12, Appendice A del manuale)
// le norme personali valgono solo per RMSSD e SDNN: le righe lfhf, si e dfa
// della tabella si scartano.
test('righe hrv_norms → range per colonna, solo rmssd e sdnn', () => {
  const r = rangesFromNormRows([
    { metric: 'rmssd', p25: 15, p75: 40 },
    { metric: 'sdnn', p25: '28', p75: '55' },
    { metric: 'lfhf', p25: '0.9', p75: '3' },
    { metric: 'si', p25: 72, p75: 245 },
    { metric: 'dfa', p25: 0.9, p75: 1.36 },
    { metric: 'ignota', p25: 1, p75: 2 },
    { metric: 'rmssd', p25: 2, p75: 1 },
  ])
  assert.deepEqual(r, { rmssd: [15, 40], sdnn: [28, 55] })
  assert.deepEqual(rangesFromNormRows([{ metric: 'sdnn', p25: null, p75: 40 }]), {})
})
