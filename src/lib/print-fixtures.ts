import type { Client, MeasurementAnalytics, OrthostaticPhaseMetrics, ProfessionalProfile } from '@/lib/types'
import type { MeasurementWithNotes } from '@/lib/report-data'

// =============================================================================
// Dati di simulazione per le pagine di stampa (verifica dei layout senza dati
// reali). Attivi SOLO fuori produzione o con PDF_FIXTURES=true, tramite
// `?fixture=standard|orthostatic|coherence|long` sulla pagina di stampa.
// =============================================================================

export type FixtureKind = 'standard' | 'orthostatic' | 'coherence' | 'long'

export function fixturesEnabled(): boolean {
  return process.env.PDF_FIXTURES === 'true' || process.env.NODE_ENV !== 'production'
}

export function isFixtureKind(v: unknown): v is FixtureKind {
  return v === 'standard' || v === 'orthostatic' || v === 'coherence' || v === 'long'
}

// Generatore deterministico (LCG) così i PDF di prova sono riproducibili.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/** Intervalli RR simulati: media `mean`, modulazione respiratoria + rumore. */
function rrSeries(n: number, mean: number, amp: number, seed: number): number[] {
  const r = rng(seed)
  const out: number[] = []
  let t = 0
  for (let i = 0; i < n; i++) {
    const resp = Math.sin((2 * Math.PI * t) / 4.2) * amp
    const slow = Math.sin((2 * Math.PI * t) / 38) * amp * 0.6
    const v = mean + resp + slow + (r() - 0.5) * amp * 0.5
    out.push(Math.round(v))
    t += v / 1000
  }
  return out
}

function phase(mean: number, rmssd: number, sdnn: number, seed: number, lfHf: number): OrthostaticPhaseMetrics {
  const rr = rrSeries(240, mean, rmssd * 0.9, seed)
  const hf = 620 / lfHf
  return {
    meanBpm: Math.round(60000 / mean),
    sdnn,
    rmssd,
    pnn50: Math.round(rmssd * 0.45),
    pnn20: Math.round(rmssd * 0.9),
    cv: +(sdnn / mean * 100).toFixed(1),
    sd1: +(rmssd / Math.SQRT2).toFixed(1),
    sd2: +(sdnn * 1.3).toFixed(1),
    sd1Sd2Ratio: +((rmssd / Math.SQRT2) / (sdnn * 1.3)).toFixed(2),
    lfPower: 620,
    hfPower: Math.round(hf),
    lfHfRatio: lfHf,
    lfNorm: Math.round((620 / (620 + hf)) * 100),
    hfNorm: Math.round((hf / (620 + hf)) * 100),
    totalPower: Math.round(620 + hf + 410),
    vlfPower: 410,
    dfaAlpha1: 0.98,
    dfaAlpha2: 0.84,
    sampEn: 1.6,
    apEn: 1.2,
    tinn: 210,
    hrvTriangularIndex: 22,
    stressIndex: Math.round(80 * lfHf),
    rmssdSdnnRatio: +(rmssd / sdnn).toFixed(2),
    sampleCount: rr.length,
    rrIntervals: rr,
  }
}

function base(kind: FixtureKind): MeasurementWithNotes {
  const rr = rrSeries(kind === 'long' ? 2400 : 420, 860, 46, 7)
  const now = new Date()
  return {
    id: `fixture-${kind}`,
    session_id: `fixture-${kind}`,
    user_id: 'fixture-pro',
    client_id: 'fixture-client',
    measured_at: now.toISOString(),
    tz_offset_minutes: 120,
    duration_seconds: kind === 'long' ? 2400 : 300,
    sensor_type: 'polar_h10',
    sensor_name: 'Polar H10',
    age: 42,
    sex: 'M',
    is_smoker: false,
    is_athlete: true,
    activity_level: 'moderate',
    rr_intervals: rr,
    rr_count: rr.length,
    artifact_percentage: 1.4,
    mean_rr: 860,
    sdnn: 58.2,
    rmssd: 44.6,
    pnn50: 21.3,
    pnn20: 48.9,
    mean_hr: 70,
    sdnn_index: 41,
    cv: 6.8,
    rmssd_sdnn_ratio: 0.77,
    vlf_power: 410,
    lf_power: 780,
    hf_power: 650,
    total_power: 1840,
    lf_hf_ratio: 1.2,
    lf_nu: 54.5,
    hf_nu: 45.5,
    lf_nu_ls: 53.1,
    hf_nu_ls: 46.9,
    ectopic_count: 2,
    signal_quality: 'good',
    lf_vlf_ratio: 1.9,
    vlf_power_ls: 400,
    lf_power_ls: 760,
    hf_power_ls: 640,
    total_power_ls: 1800,
    lf_hf_ratio_ls: 1.19,
    sd1: 31.6,
    sd2: 75.4,
    sd1_sd2_ratio: 0.42,
    dfa_alpha1: 0.96,
    dfa_alpha2: 0.88,
    sample_entropy: 1.7,
    approximate_entropy: 1.3,
    triangular_index: 24,
    tinn: 230,
    stress_index_baevsky: 78,
    score_stress: 38,
    score_recupero: 71,
    score_equilibrio: 66,
    score_energia: 62,
    score_modulazione_infiammatoria: 68,
    score_composito: 67.4,
    algorithm_version: '1.2.0',
    score_weights: null,
    tags: ['morning', 'pre_session'],
    created_at: now.toISOString(),
    test_type: kind === 'long' ? 'standard' : kind,
    duration_type: kind === 'long' ? 'free' : 'timed',
    live_tags: null,
    tag_comparison: null,
    orthostatic_data: null,
    coherence_data: null,
    segments: null,
    rolling_series: null,
    notes_professionista: 'Seduta di controllo dopo due settimane di lavoro sulla respirazione. Sonno regolare, nessun carico intenso nei due giorni precedenti.',
    indicazioni: 'Mantenere la routine serale di respirazione lenta; ricontrollo fra 14 giorni.',
  } as MeasurementWithNotes
}

export function fixtureMeasurement(kind: FixtureKind): MeasurementWithNotes {
  const m = base(kind)
  if (kind === 'orthostatic') {
    m.duration_seconds = 420
    m.orthostatic_data = {
      supine: phase(920, 52, 64, 11, 0.9),
      standing: phase(760, 24, 48, 12, 2.6),
      reactivityIndex: 72,
    }
  }
  if (kind === 'coherence') {
    m.duration_seconds = 360
    m.lf_power = 1450
    m.hf_power = 380
    m.lf_hf_ratio = 3.8
    m.coherence_data = {
      coherenceScore: 74,
      breathingRate: 6,
      peakFrequencyHz: 0.098,
      inhaleRatio: 0.45,
      coherenceSeries: [42, 51, 63, 70, 76, 81, 79, 84, 86, 82, 88, 85],
    }
  }
  if (kind === 'long') {
    const segs = 20
    m.segments = Array.from({ length: segs }, (_, i) => ({
      index: i,
      start_ms: i * 120000,
      end_ms: (i + 1) * 120000,
      duration_s: 120,
      hrv: { rmssd: 40 + Math.sin(i / 3) * 8, sdnn: 55 + Math.cos(i / 4) * 9, meanBpm: 68 + Math.sin(i / 5) * 4 },
      scores: { stress: 40 - Math.round(Math.sin(i / 3) * 8), recovery: 68 + Math.round(Math.sin(i / 3) * 6), balance: 64, energy: 60 + i % 5, inflammation: 66 },
    }))
    const pts: { k: string; t: number; v: number }[] = []
    for (let i = 0; i < 240; i++) {
      const t = i * 10000
      pts.push({ k: 'rmssd', t, v: 40 + Math.sin(i / 20) * 9 + (i % 7) * 0.4 })
      pts.push({ k: 'meanBpm', t, v: 68 + Math.cos(i / 25) * 5 })
      if (i % 6 === 0) pts.push({ k: 'stressIndex', t, v: 75 + Math.sin(i / 15) * 20 })
    }
    m.rolling_series = pts
  }
  return m
}

export function fixturePrevious(kind: FixtureKind): MeasurementAnalytics {
  const m = fixtureMeasurement(kind)
  return { ...m, session_id: 'fixture-prev', score_stress: 45, score_recupero: 64, score_equilibrio: 61, score_energia: 58, score_modulazione_infiammatoria: 63, score_composito: 61.2 }
}

export function fixtureClient(): Client {
  return {
    id: 'fixture-client',
    professionista_id: 'fixture-pro',
    nome: 'Giulia',
    cognome: 'Esempio',
    email: 'giulia.esempio@example.com',
    data_nascita: '1984-05-12',
    sesso: 'F',
  } as Client
}

export function fixtureProfessional(): ProfessionalProfile {
  return {
    id: 'fixture-pro',
    titolo: 'Dott.',
    nome: 'Marco',
    cognome: 'Rossi',
    professione: 'Fisioterapista',
    specializzazione: null,
    nome_studio: 'Studio Benessere Milano',
    indirizzo: 'Via Esempio 10, Milano',
    telefono: '+39 02 000 0000',
    sito_web: 'studiobenessere.example',
    logo_url: null,
  }
}

/** Serie di misurazioni simulate per il report periodico (una ogni ~2 giorni). */
export function fixtureReportMeasurements(from: string, to: string): MeasurementAnalytics[] {
  const r = rng(21)
  const start = new Date(`${from}T07:30:00.000Z`).getTime()
  const end = new Date(`${to}T07:30:00.000Z`).getTime()
  const out: MeasurementAnalytics[] = []
  let i = 0
  for (let t = start; t <= end; t += 2 * 86400000) {
    const m = base('standard') as MeasurementAnalytics
    const drift = (t - start) / Math.max(1, end - start)
    const iso = new Date(t).toISOString()
    out.push({
      ...m,
      id: `fixture-r-${i}`,
      session_id: `fixture-r-${i}`,
      measured_at: iso,
      score_stress: Math.round(48 - drift * 14 + (r() - 0.5) * 10),
      score_recupero: Math.round(60 + drift * 12 + (r() - 0.5) * 10),
      score_equilibrio: Math.round(62 + (r() - 0.5) * 12),
      score_energia: Math.round(58 + drift * 6 + (r() - 0.5) * 10),
      score_modulazione_infiammatoria: Math.round(64 + drift * 5 + (r() - 0.5) * 8),
      score_composito: +(62 + drift * 8).toFixed(1),
      rmssd: +(40 + drift * 8 + (r() - 0.5) * 8).toFixed(1),
      mean_hr: Math.round(72 - drift * 4 + (r() - 0.5) * 6),
      test_type: i % 5 === 4 ? 'coherence' : 'standard',
    })
    i++
  }
  return out.reverse()
}
