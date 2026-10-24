// Test delle statistiche di base dei grafici di andamento
// (src/lib/trend-stats.ts). Si esegue con `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { centroRiferimento, direzioneMeglio, media, periodoPrecedente, piuAltoEMeglio, scostamentoPct, valoriValidi, verdettoVariazione } from './trend-stats.ts'

test('media e valori validi: i giorni vuoti non valgono zero', () => {
  assert.equal(media([]), null)
  assert.equal(media([10, 20, 60]), 30)
  assert.deepEqual(valoriValidi([null, 50, undefined, 70, NaN]), [50, 70])
})

test('scostamento percentuale, con riferimento nullo o zero', () => {
  assert.equal(scostamentoPct(66, 60), 10)
  assert.equal(scostamentoPct(54, 60), -10)
  assert.equal(scostamentoPct(10, 0), null)
  assert.equal(scostamentoPct(null, 60), null)
})

test('per lo stress un calo è un miglioramento, per gli altri score una salita', () => {
  assert.equal(piuAltoEMeglio('score_stress'), false)
  assert.equal(piuAltoEMeglio('score_recupero'), true)
  assert.equal(piuAltoEMeglio('score_modulazione_infiammatoria'), true)
  assert.equal(piuAltoEMeglio('mean_hr'), false)
  assert.equal(piuAltoEMeglio('rmssd'), true)
})

// Verso dei parametri dalla forma di PARAM_REFERENCE (Appendice A del manuale,
// DECISIONI.md del 23/10/2026): DFA α1 a campana verso 1,0 (decisione 3),
// LF/HF senza direzione (decisione 12), Stress Index e FC più basso = meglio.
test('verso dei parametri HRV: campana per DFA α1, nessuno per LF/HF', () => {
  assert.equal(direzioneMeglio('score_stress'), 'lower')
  assert.equal(direzioneMeglio('score_energia'), 'higher')
  assert.equal(direzioneMeglio('rmssd'), 'higher')
  assert.equal(direzioneMeglio('mean_hr'), 'lower')
  assert.equal(direzioneMeglio('stress_index_baevsky'), 'lower')
  assert.equal(direzioneMeglio('dfa_alpha1'), 'bell')
  assert.equal(direzioneMeglio('dfa_alpha2'), 'bell')
  assert.equal(direzioneMeglio('sd1_sd2_ratio'), 'bell')
  assert.equal(direzioneMeglio('rmssd_sdnn_ratio'), 'bell')
  assert.equal(direzioneMeglio('lf_nu'), 'bell')
  assert.equal(direzioneMeglio('lf_hf_ratio'), 'none')
  assert.equal(direzioneMeglio('lf_hf_ratio_ls'), 'none')
  assert.equal(direzioneMeglio('colonna_ignota'), 'higher')
  assert.equal(centroRiferimento('dfa_alpha1'), 1.0)
  // Compatibilità: solo 'lower' dà falso.
  assert.equal(piuAltoEMeglio('lf_hf_ratio'), true)
  assert.equal(piuAltoEMeglio('dfa_alpha1'), true)
})

test('verdetto della variazione: 10% stabile, campana verso 1,0, LF/HF senza verdetto', () => {
  assert.equal(verdettoVariazione(30, 32, 'rmssd'), 'stable')
  assert.equal(verdettoVariazione(30, 34, 'rmssd'), 'improved')
  assert.equal(verdettoVariazione(30, 26, 'rmssd'), 'declined')
  assert.equal(verdettoVariazione(70, 62, 'mean_hr'), 'improved')
  assert.equal(verdettoVariazione(200, 150, 'stress_index_baevsky'), 'improved')
  // DFA α1: 0,70 → 0,90 si avvicina a 1,0 (migliora); 1,05 → 1,30 si allontana.
  assert.equal(verdettoVariazione(0.7, 0.9, 'dfa_alpha1'), 'improved')
  assert.equal(verdettoVariazione(1.05, 1.3, 'dfa_alpha1'), 'declined')
  assert.equal(verdettoVariazione(1.3, 1.1, 'dfa_alpha1'), 'improved')
  assert.equal(verdettoVariazione(1.0, 1.05, 'dfa_alpha1'), 'stable')
  // LF/HF: nessuna direzione, fuori dal 10% resta 'unknown'.
  assert.equal(verdettoVariazione(1.0, 2.0, 'lf_hf_ratio'), 'unknown')
  assert.equal(verdettoVariazione(1.0, 1.05, 'lf_hf_ratio'), 'stable')
  assert.equal(verdettoVariazione(null, 1, 'rmssd'), 'unknown')
})

test('periodo precedente di pari lunghezza', () => {
  assert.deepEqual(periodoPrecedente('2026-10-08', '2026-10-14'), { from: '2026-10-01', to: '2026-10-07' })
  assert.deepEqual(periodoPrecedente('2026-03-01', '2026-03-01'), { from: '2026-02-28', to: '2026-02-28' })
  assert.deepEqual(periodoPrecedente('2026-01-01', '2026-01-31'), { from: '2025-12-01', to: '2025-12-31' })
})
