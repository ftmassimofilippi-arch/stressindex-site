// Test di src/lib/hrv-reference.ts (npm test): ogni numero è fissato contro
// l'Appendice A del manuale come riassunta in DECISIONI.md del 23/10/2026.
// Se cambia il manuale, cambia il numero qui e nel modulo, non la regola.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ORTHO,
  PARAM_REFERENCE,
  PARAMS_WITHOUT_REFERENCE,
  QUALITY_BANDS,
  STABLE_DELTA,
  isIndicativeOnly,
  paramsSummary,
  rangeStatus,
  referenceRangeText,
  withPersonalRanges,
} from './hrv-reference.ts'

// ── Range generici (Appendice A, ultimo paragrafo di DECISIONI.md) ──────────

const RANGES: Record<string, [number, number]> = {
  mean_hr: [50, 70],
  sdnn: [30, 50],
  rmssd: [30, 60],
  pnn50: [5, 25],
  pnn20: [30, 60],
  cv: [4, 8],
  rmssd_sdnn_ratio: [0.5, 0.9],
  vlf_power: [200, 2000],
  lf_power: [500, 2000],
  hf_power: [300, 1500],
  total_power: [1500, 5000],
  lf_hf_ratio: [0.5, 2.0],
  lf_nu: [30, 60],
  hf_nu: [25, 50],
  sd1: [20, 50],
  sd2: [40, 100],
  sd1_sd2_ratio: [0.3, 0.6],
  dfa_alpha1: [0.85, 1.15],
  dfa_alpha2: [0.95, 1.1],
  sample_entropy: [1.0, 2.0],
  approximate_entropy: [0.8, 1.5],
  stress_index_baevsky: [50, 150],
  triangular_index: [15, 40],
  tinn: [100, 300],
}

test('24 parametri con il range dell\'Appendice A, tutti con il riferimento al manuale', () => {
  assert.deepEqual(Object.keys(PARAM_REFERENCE).sort(), Object.keys(RANGES).sort())
  for (const [key, range] of Object.entries(RANGES)) {
    assert.deepEqual(PARAM_REFERENCE[key].range, range, key)
    assert.equal(PARAM_REFERENCE[key].manual, 'Appendice A', key)
  }
  assert.ok(PARAMS_WITHOUT_REFERENCE.has('lf_vlf_ratio'))
})

// ── Semaforo parametro per parametro ─────────────────────────────────────────

const s = (key: string, v: number) => rangeStatus(v, key)

test('Mean HR (decisione 7): 50-70 verde, 70-80 giallo, >80 rosso, 45-50 giallo, <45 rosso', () => {
  assert.equal(s('mean_hr', 60), 'in')
  assert.equal(s('mean_hr', 50), 'in')
  assert.equal(s('mean_hr', 70), 'in')
  assert.equal(s('mean_hr', 75), 'edge')
  assert.equal(s('mean_hr', 80), 'edge')
  assert.equal(s('mean_hr', 81), 'out')
  assert.equal(s('mean_hr', 47), 'edge')
  assert.equal(s('mean_hr', 45), 'edge')
  assert.equal(s('mean_hr', 44), 'out')
})

test('SDNN: 30-50 verde, sopra verde (alto = bene), 20-30 giallo, <20 rosso', () => {
  assert.equal(s('sdnn', 40), 'in')
  assert.equal(s('sdnn', 78), 'in')
  assert.equal(s('sdnn', 25), 'edge')
  assert.equal(s('sdnn', 20), 'edge')
  assert.equal(s('sdnn', 19.9), 'out')
})

test('RMSSD: 30-60 verde, sopra verde, 20-30 giallo, <20 rosso', () => {
  assert.equal(s('rmssd', 45), 'in')
  assert.equal(s('rmssd', 90), 'in')
  assert.equal(s('rmssd', 22), 'edge')
  assert.equal(s('rmssd', 14), 'out')
})

test('pNN50: 5-25 verde, sopra verde, 3-5 giallo, <3 rosso', () => {
  assert.equal(s('pnn50', 10), 'in')
  assert.equal(s('pnn50', 38), 'in')
  assert.equal(s('pnn50', 4), 'edge')
  assert.equal(s('pnn50', 1), 'out')
})

test('pNN20: 30-60 verde, sopra verde, 20-30 giallo, <20 rosso', () => {
  assert.equal(s('pnn20', 45), 'in')
  assert.equal(s('pnn20', 70), 'in')
  assert.equal(s('pnn20', 25), 'edge')
  assert.equal(s('pnn20', 19), 'out')
})

test('CV (decisione 5): 4-8 verde, >8 verde, 3-4 giallo, <3 rosso', () => {
  assert.equal(s('cv', 6), 'in')
  assert.equal(s('cv', 9), 'in')
  assert.equal(s('cv', 3.5), 'edge')
  assert.equal(s('cv', 2.9), 'out')
})

test('RMSSD/SDNN (decisione 11): 0,5-0,9 verde, 0,4-0,5 e 0,9-1,0 giallo, fuori rosso', () => {
  assert.equal(s('rmssd_sdnn_ratio', 0.7), 'in')
  assert.equal(s('rmssd_sdnn_ratio', 0.45), 'edge')
  assert.equal(s('rmssd_sdnn_ratio', 0.39), 'out')
  assert.equal(s('rmssd_sdnn_ratio', 0.95), 'edge')
  assert.equal(s('rmssd_sdnn_ratio', 1.01), 'out')
})

test('VLF: 200-2000, <200 giallo (mai rosso), sopra verde', () => {
  assert.equal(s('vlf_power', 800), 'in')
  assert.equal(s('vlf_power', 150), 'edge')
  assert.equal(s('vlf_power', 10), 'edge')
  assert.equal(s('vlf_power', 3000), 'in')
})

test('LF 500-2000 e HF 300-1500: giallo entro il 20% sotto, rosso oltre, sopra verde (decisione 13)', () => {
  assert.equal(s('lf_power', 1000), 'in')
  assert.equal(s('lf_power', 2500), 'in')
  assert.equal(s('lf_power', 250), 'edge') // 20% di 1500 = 300 → giallo da 200
  assert.equal(s('lf_power', 199), 'out')
  assert.equal(s('hf_power', 700), 'in')
  assert.equal(s('hf_power', 220), 'edge') // 20% di 1200 = 240 → giallo da 60
  assert.equal(s('hf_power', 59), 'out')
})

test('Total Power: 1500-5000 verde, sopra verde, 1000-1500 giallo, <1000 rosso', () => {
  assert.equal(s('total_power', 3000), 'in')
  assert.equal(s('total_power', 5800), 'in')
  assert.equal(s('total_power', 1200), 'edge')
  assert.equal(s('total_power', 720), 'out')
})

test('LF/HF (decisione 12): nessun semaforo, range solo orientativo 0,5-2,0', () => {
  assert.equal(s('lf_hf_ratio', 1), 'none')
  assert.equal(s('lf_hf_ratio', 5), 'none')
  assert.equal(isIndicativeOnly('lf_hf_ratio'), true)
  assert.equal(isIndicativeOnly('rmssd'), false)
  assert.equal(referenceRangeText('lf_hf_ratio'), '0.5–2')
  assert.equal(referenceRangeText('lf_hf_ratio', null, (n) => n.toFixed(1).replace('.', ',')), '0,5–2,0')
})

test('LF/VLF (decisione 14): nessun riferimento', () => {
  assert.equal(s('lf_vlf_ratio', 1), 'none')
  assert.equal(referenceRangeText('lf_vlf_ratio'), null)
})

test('LF norm: 30-60 a campana, 60-70 giallo, >70 rosso; sotto giallo entro 24, rosso oltre', () => {
  assert.equal(s('lf_nu', 45), 'in')
  assert.equal(s('lf_nu', 65), 'edge')
  assert.equal(s('lf_nu', 70), 'edge')
  assert.equal(s('lf_nu', 71), 'out')
  assert.equal(s('lf_nu', 26), 'edge')
  assert.equal(s('lf_nu', 23), 'out')
})

test('HF norm: 25-50 verde, sopra verde, 20-25 giallo, <20 rosso', () => {
  assert.equal(s('hf_nu', 35), 'in')
  assert.equal(s('hf_nu', 60), 'in')
  assert.equal(s('hf_nu', 22), 'edge')
  assert.equal(s('hf_nu', 19), 'out')
})

test('SD1 20-50 e SD2 40-100: sopra verde, giallo entro il 20% sotto, rosso oltre', () => {
  assert.equal(s('sd1', 46), 'in')
  assert.equal(s('sd1', 55), 'in')
  assert.equal(s('sd1', 15), 'edge') // 20% di 30 = 6 → giallo da 14
  assert.equal(s('sd1', 10), 'out')
  assert.equal(s('sd2', 70), 'in')
  assert.equal(s('sd2', 30), 'edge') // 20% di 60 = 12 → giallo da 28
  assert.equal(s('sd2', 27), 'out')
})

test('SD1/SD2: 0,3-0,6 a campana, giallo entro 0,06 oltre i bordi, rosso oltre', () => {
  assert.equal(s('sd1_sd2_ratio', 0.5), 'in')
  assert.equal(s('sd1_sd2_ratio', 0.26), 'edge')
  assert.equal(s('sd1_sd2_ratio', 0.2), 'out')
  assert.equal(s('sd1_sd2_ratio', 0.65), 'edge')
  assert.equal(s('sd1_sd2_ratio', 0.7), 'out')
})

test('DFA α1 (decisione 3): 0,85-1,15 verde, 0,75-0,85 e 1,15-1,20 giallo, <0,75 e >1,20 rosso', () => {
  assert.equal(s('dfa_alpha1', 1.05), 'in')
  assert.equal(s('dfa_alpha1', 0.8), 'edge')
  assert.equal(s('dfa_alpha1', 0.75), 'edge')
  assert.equal(s('dfa_alpha1', 0.68), 'out')
  assert.equal(s('dfa_alpha1', 1.18), 'edge')
  assert.equal(s('dfa_alpha1', 1.25), 'out')
})

test('DFA α2: 0,95-1,10 a campana, giallo entro 0,03 oltre i bordi, rosso oltre', () => {
  assert.equal(s('dfa_alpha2', 1.0), 'in')
  assert.equal(s('dfa_alpha2', 0.93), 'edge')
  assert.equal(s('dfa_alpha2', 0.9), 'out')
  assert.equal(s('dfa_alpha2', 1.12), 'edge')
  assert.equal(s('dfa_alpha2', 1.2), 'out')
})

test('SampEn 1,0-2,0 e ApEn 0,8-1,5 (decisione 6): giallo fuori, mai rosso sopra, rosso sotto 0,5', () => {
  assert.equal(s('sample_entropy', 1.8), 'in')
  assert.equal(s('sample_entropy', 0.9), 'edge')
  assert.equal(s('sample_entropy', 0.5), 'edge')
  assert.equal(s('sample_entropy', 0.49), 'out')
  assert.equal(s('sample_entropy', 2.5), 'edge')
  assert.equal(s('sample_entropy', 4), 'edge')
  assert.equal(s('approximate_entropy', 1.0), 'in')
  assert.equal(s('approximate_entropy', 0.6), 'edge')
  assert.equal(s('approximate_entropy', 0.4), 'out')
  assert.equal(s('approximate_entropy', 2.2), 'edge')
})

test('Stress Index di Baevsky (decisione 4): 50-150 verde, sotto 50 verde, 150-200 giallo, >200 rosso', () => {
  assert.equal(s('stress_index_baevsky', 65), 'in')
  assert.equal(s('stress_index_baevsky', 30), 'in')
  assert.equal(s('stress_index_baevsky', 180), 'edge')
  assert.equal(s('stress_index_baevsky', 200), 'edge')
  assert.equal(s('stress_index_baevsky', 201), 'out')
  assert.equal(s('stress_index_baevsky', 380), 'out')
})

test('Triangular Index 15-40 e TINN 100-300: sopra verde, giallo entro il 20% sotto, rosso oltre', () => {
  assert.equal(s('triangular_index', 32), 'in')
  assert.equal(s('triangular_index', 45), 'in')
  assert.equal(s('triangular_index', 12), 'edge') // 20% di 25 = 5 → giallo da 10
  assert.equal(s('triangular_index', 8), 'out')
  assert.equal(s('tinn', 220), 'in')
  assert.equal(s('tinn', 350), 'in')
  assert.equal(s('tinn', 65), 'edge') // 20% di 200 = 40 → giallo da 60
  assert.equal(s('tinn', 59), 'out')
})

test('valori assenti o non numerici e chiavi sconosciute: none', () => {
  assert.equal(rangeStatus(null, 'rmssd'), 'none')
  assert.equal(rangeStatus(undefined, 'rmssd'), 'none')
  assert.equal(rangeStatus('abc', 'rmssd'), 'none')
  assert.equal(rangeStatus('45', 'rmssd'), 'in')
  assert.equal(rangeStatus(45, 'colonna_ignota'), 'none')
})

// ── Range personali (hrv_norms, solo RMSSD e SDNN) ───────────────────────────

test('range personale: vince sul generico con la stessa tolleranza del 20%, sopra resta verde', () => {
  // p25-p75 = 10-28: giallo fino a 6,4 (20% di 18 = 3,6), rosso sotto.
  assert.equal(rangeStatus(20, 'rmssd', [10, 28]), 'in')
  assert.equal(rangeStatus(8, 'rmssd', [10, 28]), 'edge')
  assert.equal(rangeStatus(6, 'rmssd', [10, 28]), 'out')
  assert.equal(rangeStatus(40, 'rmssd', [10, 28]), 'in')
  // Senza range personale lo stesso 20 è giallo sul generico.
  assert.equal(rangeStatus(20, 'rmssd'), 'edge')
  assert.deepEqual(withPersonalRanges({ rmssd: [10, 28] }).rmssd, [10, 28])
  assert.deepEqual(withPersonalRanges(null).rmssd, [30, 60])
  assert.equal(referenceRangeText('rmssd', [10, 28]), '10–28')
})

// ── Fixture del manuale ──────────────────────────────────────────────────────

test('atleta in piena forma (manuale): tutto nella norma', () => {
  const atleta = {
    mean_hr: 52, sdnn: 78, rmssd: 65, pnn50: 38, total_power: 5800, hf_power: 1400,
    dfa_alpha1: 1.05, sample_entropy: 1.8, stress_index_baevsky: 65, triangular_index: 32,
    tinn: 220, sd1: 46, sd1_sd2_ratio: 0.5,
  }
  for (const [key, v] of Object.entries(atleta)) assert.equal(rangeStatus(v, key), 'in', key)
  const sum = paramsSummary(atleta)
  assert.deepEqual(sum, { inRange: 13, edge: 0, outOfRange: 0, total: 13 })
})

test('cliente in burnout (manuale): mai nella norma, rosso o giallo', () => {
  const burnout = {
    mean_hr: 84, sdnn: 18, rmssd: 14, pnn50: 1, total_power: 720, hf_power: 220,
    dfa_alpha1: 0.68, sample_entropy: 0.9, stress_index_baevsky: 380, triangular_index: 8,
    tinn: 65, sd1: 10,
  }
  for (const [key, v] of Object.entries(burnout)) assert.notEqual(rangeStatus(v, key), 'in', key)
  const sum = paramsSummary(burnout)
  assert.equal(sum.inRange, 0)
  assert.equal(sum.total, 12)
  assert.equal(sum.edge + sum.outOfRange, 12)
  // Rossi netti del manuale.
  for (const key of ['mean_hr', 'sdnn', 'rmssd', 'pnn50', 'total_power', 'dfa_alpha1', 'stress_index_baevsky']) {
    assert.equal(rangeStatus(burnout[key as keyof typeof burnout], key), 'out', key)
  }
})

test('conteggio: LF/HF e LF/VLF non entrano fra i parametri confrontati', () => {
  const sum = paramsSummary({ rmssd: 45, lf_hf_ratio: 1.2, lf_vlf_ratio: 2, sdnn: 'n.d.' })
  assert.deepEqual(sum, { inRange: 1, edge: 0, outOfRange: 0, total: 1 })
})

// ── Soglie condivise ─────────────────────────────────────────────────────────

test('soglie condivise: stabile (decisione 9), qualità, ortostatico (decisione 10)', () => {
  assert.deepEqual(STABLE_DELTA, { score: 10, paramPct: 10 })
  assert.deepEqual(QUALITY_BANDS, { silent: 5, warn: 15 })
  assert.deepEqual(ORTHO, { hrMin: 10, hrMax: 30, rmssdDropMin: 30, rmssdDropMax: 70, rmssdDropExcess: 75, reactivity: [40, 70] })
})
