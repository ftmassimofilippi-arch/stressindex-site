// Test dei conteggi della home (src/lib/home-metrics.ts), con `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clientiAttivi, trendMensileDaGiorni, variazionePercentuale } from './home-metrics.ts'

const ORA = new Date('2026-10-15T10:00:00Z')

test('clienti attivi: ultima misurazione entro 90 giorni, mai misurato escluso', () => {
  const n = clientiAttivi(
    [
      { last_measurement_at: '2026-10-14T08:00:00Z' },
      { last_measurement_at: '2026-07-20T08:00:00Z' }, // 87 giorni
      { last_measurement_at: '2026-07-10T08:00:00Z' }, // 97 giorni
      { last_measurement_at: null },
      {},
    ],
    90,
    ORA,
  )
  assert.equal(n, 2)
})

test('variazione percentuale: segno e denominatore zero', () => {
  assert.equal(variazionePercentuale(65, 12), ((65 - 12) / 12) * 100)
  assert.equal(variazionePercentuale(6, 12), -50)
  assert.equal(variazionePercentuale(12, 12), 0)
  assert.equal(variazionePercentuale(5, 0), null)
})

function sessanta(): string[] {
  const out: string[] = []
  for (let i = 59; i >= 0; i--) out.push(new Date(Date.UTC(2026, 9, 15) - i * 86_400_000).toISOString().slice(0, 10))
  return out
}

test('trend mensile: le due finestre di 30 giorni e il totale fuori finestra', () => {
  const giorni = sessanta()
  assert.equal(giorni[0], '2026-08-17')
  assert.equal(giorni[59], '2026-10-15')
  const t = trendMensileDaGiorni(
    ['2026-10-15', '2026-10-15', '2026-09-16', '2026-09-15', '2026-08-17', '2026-08-16', null],
    giorni,
  )
  // 16/09 è il primo giorno della finestra corrente, 15/09 l'ultimo della precedente.
  assert.equal(t.correnti, 3)
  assert.equal(t.precedenti, 2)
  assert.equal(t.variazione, 50)
})

test('trend mensile: senza misurazioni nel mese precedente la variazione è n.d.', () => {
  const t = trendMensileDaGiorni(['2026-10-15'], sessanta())
  assert.equal(t.correnti, 1)
  assert.equal(t.precedenti, 0)
  assert.equal(t.variazione, null)
})
