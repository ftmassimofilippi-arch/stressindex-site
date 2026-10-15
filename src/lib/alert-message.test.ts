// Test della composizione dei messaggi degli alert (src/lib/alert-message.ts):
// gli eventi dell'app arrivano nella lingua del telefono del cliente, quelli
// del cron in italiano fisso; il sito li ricompone nella lingua della pagina.
// Si esegue con `npm test` (node --test, senza dipendenze aggiuntive).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alertMessage, alertValueDecimals } from './alert-message.ts'

// Traduttore finto: restituisce la chiave e i valori, così si vede cosa è
// stato chiesto senza caricare i file messaggi.
const t = (key: string, values?: Record<string, string | number | Date>) =>
  values ? `${key} ${JSON.stringify(values)}` : key
const tScores = (key: string) => ({ 'names.stress': 'Stress', 'names.recovery': 'Recupero', 'names.balance': 'Equilibrio' })[key] ?? key
const fmt = (v: number) => String(v).replace('.', ',')
const fmtDate = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`

test('evento dell\'app in inglese: i numeri vengono estratti e la frase ricomposta', () => {
  const out = alertMessage(
    { type: 'sdnn_low', source: 'app', message: 'Doretta Sabbatini has an SDNN of 21.5 ms, below the reference threshold.' },
    t, fmt,
  )
  assert.equal(out, 'messages.sdnnLow {"value":"21,5"}')
})

test('evento dell\'app con numeri che non tornano: resta il testo originale', () => {
  const raw = 'Something unexpected without numbers'
  assert.equal(alertMessage({ type: 'rmssd_drop_20', source: 'app', message: raw }, t, fmt), raw)
})

test('alert del cron su uno score: nome dell\'indice tradotto e valore', () => {
  const alert = { type: 'high_stress', message: 'Indice di Stress elevato: 85.2 (soglia 80)', triggering_value: 85.2, triggering_metric: 'score_stress' }
  assert.equal(alertMessage(alert, t, fmt, { tScores }), 'Stress: 85,2')
  assert.equal(alertMessage({ ...alert, type: 'abnormal_value', triggering_metric: 'score_equilibrio', triggering_value: 12.64 }, t, fmt, { tScores }), 'Equilibrio: 12,64')
})

test('alert del cron senza traduttore degli score o con metrica ignota: "valore {n}"', () => {
  const alert = { type: 'high_stress', triggering_value: 85.2, triggering_metric: 'score_stress' }
  assert.equal(alertMessage(alert, t, fmt), 'messages.value {"value":"85,2"}')
  assert.equal(alertMessage({ ...alert, triggering_metric: 'rmssd' }, t, fmt, { tScores }), 'messages.value {"value":"85,2"}')
})

test('misurazione mancata: data e giorni riletti dal testo del cron', () => {
  const alert = { type: 'missed_measurement', message: 'Ultima misurazione: 07/10/2026 (oltre 14 giorni)', triggering_metric: 'last_measurement_at' }
  assert.equal(alertMessage(alert, t, fmt, { fmtDate }), 'messages.missedSince {"date":"7.10.2026","days":"14"}')
  // Senza formattatore di data resta GG/MM/AAAA.
  assert.equal(alertMessage(alert, t, fmt), 'messages.missedSince {"date":"07/10/2026","days":"14"}')
  assert.equal(alertMessage({ type: 'missed_measurement', message: 'Cliente non ha mai misurato' }, t, fmt), 'messages.neverMeasured')
  // Testo imprevisto: si mostra com'è.
  assert.equal(alertMessage({ type: 'missed_measurement', message: 'altro' }, t, fmt), 'altro')
})

test('alertValueDecimals conserva i decimali presenti, al massimo due', () => {
  assert.equal(alertValueDecimals(32), 0)
  assert.equal(alertValueDecimals(0.45), 2)
  assert.equal(alertValueDecimals(21.5), 1)
  assert.equal(alertValueDecimals(12.6437), 2)
})
