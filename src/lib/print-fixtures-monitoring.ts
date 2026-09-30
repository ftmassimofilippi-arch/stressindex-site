import type {
  BaselineSnapshot, CosinorSummary, EventResponse, HourPattern, Monitoring24hSession, MonitoringBout, MonitoringEvent, MonitoringEventType,
  MonitoringNight, MonitoringNightHour, MonitoringScores, MonitoringState, MonitoringSummary, MonitoringWindow, Odi3Label, RecoveryPauses, ReserveCurve,
  ReturnTimes, SeriesHrv, SleepDesaturationEvent, SleepHour, SleepScore, SleepSession, SleepWindow, SleepWindowState, T90Label,
} from './monitoring-types'
import type { Lang } from './monitoring-strings'
import { fixtureClient } from './print-fixtures'

// =============================================================================
// Dati di simulazione del Monitoraggio 24h e del modulo Sonno per le pagine di
// stampa (`?fixture=24h|sleep`, attivi solo con fixturesEnabled()). Nessun dato
// reale: le serie sono generate qui con gli stessi parametri dei simulatori
// dell'app Flutter (lib/utils/sleep_simulator.dart, notte "Desaturazioni
// lievi"; lib/utils/monitoring_simulator.dart, 24 ore dalle 15:00) e poi
// aggregate nelle stesse strutture che l'app scrive nel database. I numeri
// derivati (indici, score, frasi) sono calcolati SOLO qui per la simulazione:
// in produzione il sito non ricalcola nulla.
// =============================================================================

export type MonitoringFixtureKind = '24h' | 'sleep'

export function isMonitoringFixtureKind(v: unknown): v is MonitoringFixtureKind {
  return v === '24h' || v === 'sleep'
}

/** Fuso del dispositivo simulato (Europa centrale, ora legale). */
const TZ = 120

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

function gaussOf(r: () => number) {
  return () => {
    const u1 = 1 - r()
    const u2 = r()
    return Math.sqrt(-2 * Math.log(Math.max(1e-12, u1))) * Math.cos(2 * Math.PI * u2)
  }
}

const iso = (ms: number) => new Date(ms).toISOString()
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[clamp(Math.round((s.length - 1) * p), 0, s.length - 1)]
}
function sd(xs: number[]): number {
  const m = mean(xs)
  return xs.length ? Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) : 0
}

/** Istante UTC dell'ora locale `hour` (decimale) del giorno `day` (YYYY-MM-DD) nel fuso simulato. */
function localMs(day: string, hour: number): number {
  return new Date(`${day}T00:00:00.000Z`).getTime() + hour * 3_600_000 - TZ * 60_000
}

function clientName(): string {
  const c = fixtureClient()
  return `${c.nome} ${c.cognome}`
}

// ── Sonno: notte "Desaturazioni lievi" del simulatore dell'app ───────────────

const SLEEP_DT = 4
const SLEEP_HOURS = 8
const SLEEP_DAY = '2026-09-14'

export function fixtureSleepSession(lang: Lang = 'it'): SleepSession {
  const r = rng(42)
  const gauss = gaussOf(r)
  const n = Math.round((SLEEP_HOURS * 3600) / SLEEP_DT)
  const startMs = localMs(SLEEP_DAY, 23)
  const at = (sec: number) => startMs + sec * 1000

  // Desaturazioni programmate: una ogni 5 minuti fra 0:30 e 7:30 (circa 10/h).
  const desats: Array<{ at: number; depth: number; dur: number }> = []
  for (let t = 1800; t < Math.round(SLEEP_HOURS * 3600 - 1800); t += 300) {
    desats.push({ at: t, depth: 4 + Math.floor(r() * 3), dur: 40 })
  }
  // Movimento: tre burst di 2-4 minuti (risvegli stimati).
  const bursts = [
    { at: 1 * 3600 + 900, dur: 150 },
    { at: 4 * 3600 + 300, dur: 200 },
    { at: Math.round(SLEEP_HOURS * 3600 - 900), dur: 240 },
  ]

  const spo2 = new Array<number>(n)
  const pr = new Array<number>(n)
  const mov = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const t = i * SLEEP_DT
    const h = t / 3600
    let s = 96.6 + 0.3 * Math.sin((2 * Math.PI * h) / 3) + gauss() * 0.35
    let p = 66 - 11 * Math.sin((Math.PI * h) / SLEEP_HOURS) - (2 * h) / SLEEP_HOURS + gauss() * 1.4
    let v = 0
    for (const d of desats) {
      const rel = t - d.at
      if (rel < 0 || rel > d.dur + 20) continue
      const third = d.dur / 3
      let shape: number
      if (rel <= third) shape = rel / third
      else if (rel <= 2 * third) shape = 1
      else if (rel <= d.dur) shape = (d.dur - rel) / third
      else shape = 0
      s -= d.depth * shape
      if (rel >= 2 * third && rel <= 2 * third + 20 && d.depth >= 3) p += 8
    }
    for (const b of bursts) {
      if (t >= b.at && t < b.at + b.dur) {
        v = 25 + Math.floor(r() * 30)
        p += 10
      }
    }
    spo2[i] = clamp(Math.round(s), 50, 100)
    pr[i] = clamp(Math.round(p), 25, 250)
    mov[i] = v
  }

  // Eventi di desaturazione: baseline locale (mediana dei 120-8 s precedenti), nadir, calo, surge del polso.
  const events: SleepDesaturationEvent[] = []
  for (const d of desats) {
    const i0 = Math.floor(d.at / SLEEP_DT)
    const i1 = Math.min(n - 1, Math.floor((d.at + d.dur) / SLEEP_DT))
    const base = median(spo2.slice(Math.max(0, i0 - 30), Math.max(1, i0 - 2)))
    let nadir = 100
    let nadirIdx = i0
    for (let i = i0; i <= i1; i++) if (spo2[i] < nadir) { nadir = spo2[i]; nadirIdx = i }
    const drop = base - nadir
    if (drop < 3) continue
    const before = mean(pr.slice(Math.max(0, i0 - 15), i0))
    const after = Math.max(...pr.slice(nadirIdx, Math.min(n, nadirIdx + 6)))
    events.push({
      start: iso(at(d.at)),
      duration_sec: d.dur,
      baseline: r1(base),
      nadir,
      drop: r1(drop),
      nadir_time: iso(at(nadirIdx * SLEEP_DT)),
      surge_bpm: r1(after - before),
    })
  }

  // Finestre da 1 minuto (15 campioni).
  const perMin = 60 / SLEEP_DT
  const minutes = Math.floor(n / perMin)
  const windows: SleepWindow[] = []
  for (let m = 0; m < minutes; m++) {
    const sl = spo2.slice(m * perMin, (m + 1) * perMin)
    const pl = pr.slice(m * perMin, (m + 1) * perMin)
    const ml = mov.slice(m * perMin, (m + 1) * perMin)
    const s = at(m * 60)
    const e = at((m + 1) * 60)
    const ev = events.filter((x) => { const t = new Date(x.start).getTime(); return t >= s && t < e }).length
    const inEvent = events.some((x) => { const t0 = new Date(x.start).getTime(); return t0 < e && t0 + x.duration_sec * 1000 > s })
    const mn = Math.min(...sl)
    const mv = Math.round(mean(ml))
    let state: SleepWindowState = 'normale'
    if (inEvent || ev > 0) state = 'desaturazione'
    else if (mn < 90) state = 'sotto90'
    else if (mv > 0) state = 'movimento'
    windows.push({ s: iso(s), e: iso(e), state, spo2: r1(mean(sl)), spo2_min: mn, pr: Math.round(mean(pl)), mov: mv, ev })
  }

  // Ossigenazione.
  const validMin = minutes
  const below = (th: number) => spo2.filter((v) => v < th).length * SLEEP_DT / 60
  const t90m = below(90), t88m = below(88), t85m = below(85)
  const pct = (m: number) => r2((m / validMin) * 100)
  const nadirIdx = spo2.indexOf(Math.min(...spo2))
  const odi3 = r2(events.length / (validMin / 60))
  const ev4 = events.filter((e) => (e.drop ?? 0) >= 4).length
  const odi4 = r2(ev4 / (validMin / 60))
  const avg12 = Array.from({ length: Math.floor(n / 3) }, (_, k) => mean(spo2.slice(k * 3, k * 3 + 3)))
  const deltaIndex = r2(mean(avg12.slice(1).map((v, k) => Math.abs(v - avg12[k]))))
  const oxygenation = {
    spo2_basal: median(spo2),
    mean_spo2: r1(mean(spo2)),
    nadir: spo2[nadirIdx],
    nadir_time: iso(at(nadirIdx * SLEEP_DT)),
    spo2_sd: r2(sd(spo2)),
    delta_index_12s: deltaIndex,
    odi3,
    odi4,
    odi3_label: (odi3 < 5 ? 'normal' : odi3 < 15 ? 'mild' : odi3 < 30 ? 'moderate' : 'marked') as Odi3Label,
    event_count: events.length,
    event_count_4: ev4,
    t90_minutes: r1(t90m),
    t90_pct: pct(t90m),
    t88_minutes: r1(t88m),
    t88_pct: pct(t88m),
    t85_minutes: r1(t85m),
    t85_pct: pct(t85m),
    t90_label: (pct(t90m) < 1 ? 'normal' : pct(t90m) <= 5 ? 'observe' : 'relevant') as T90Label,
    cyclic_runs: 0,
    cyclic_minutes: 0,
  }

  // Cuore.
  const minPrIdx = pr.indexOf(Math.min(...pr))
  const basal = percentile(pr, 0.1)
  const firstHour = median(pr.slice(0, 900))
  const first3h = mean(pr.slice(0, 2700))
  const last3h = mean(pr.slice(n - 2700))
  const surgeCount = events.filter((e) => (e.surge_bpm ?? 0) >= 6).length
  const cardiac = {
    mean_pr: r1(mean(pr)),
    min_pr: pr[minPrIdx],
    min_pr_time: iso(at(minPrIdx * SLEEP_DT)),
    max_pr: Math.max(...pr),
    pr_basal: basal,
    first_hour_median_pr: firstHour,
    dip_pct: r1(((firstHour - basal) / firstHour) * 100),
    first_3h_mean_pr: r1(first3h),
    last_3h_mean_pr: r1(last3h),
    trend_bpm: r1(first3h - last3h),
    surge_event_pct: r1(events.length ? (surgeCount / events.length) * 100 : 0),
  }

  // Movimento.
  const movedMinutes = windows.filter((w) => (w.mov ?? 0) > 0).length
  const movement = {
    available: true,
    moved_minutes: movedMinutes,
    moved_pct: r1((movedMinutes / minutes) * 100),
    estimated_awakenings: bursts.length,
    normalization_p95: percentile(mov.filter((v) => v > 0), 0.95) || null,
  }

  // Profilo orario.
  const hourly: SleepHour[] = []
  for (let h = 0; h < SLEEP_HOURS; h++) {
    const ws = windows.slice(h * 60, (h + 1) * 60)
    hourly.push({
      hour_start: iso(at(h * 3600)),
      spo2: r1(mean(ws.map((w) => w.spo2 ?? 0))),
      pr: r1(mean(ws.map((w) => w.pr ?? 0))),
      events: ws.reduce((a, w) => a + w.ev, 0),
    })
  }

  // Sleep Score: quattro componenti 0-100 e media pesata 35 / 30 / 20 / 15.
  const cOxy = Math.round(clamp(100 - (97 - oxygenation.mean_spo2) * 8 - oxygenation.t90_pct * 6 - Math.max(0, 90 - oxygenation.nadir) * 3, 0, 100))
  const cResp = Math.round(clamp(100 - odi3 * 3.5, 0, 100))
  const cCard = Math.round(clamp(40 + cardiac.dip_pct * 2.5 + (cardiac.trend_bpm > 0 ? 10 : 0) - cardiac.surge_event_pct * 0.25, 0, 100))
  const cCont = Math.round(clamp(100 - movement.moved_pct * 4 - movement.estimated_awakenings * 5, 0, 100))
  const total = Math.round(0.35 * cOxy + 0.3 * cResp + 0.2 * cCard + 0.15 * cCont)
  const score: SleepScore = {
    total,
    label: total < 50 ? 'poor' : total < 65 ? 'sufficient' : total < 80 ? 'good' : total < 90 ? 'very_good' : 'excellent',
    oxygenation: cOxy,
    respiratory_stability: cResp,
    cardiac_recovery: cCard,
    continuity: cCont,
    weights: { oxygenation: 0.35, respiratory_stability: 0.3, cardiac_recovery: 0.2, continuity: 0.15 },
  }

  const phrase = sleepPhrase(lang, { odi3: Math.round(odi3), mean: r1(oxygenation.mean_spo2), trendDown: cardiac.trend_bpm > 0 })
  const endMs = at(minutes * 60)
  const now = iso(endMs + 3_600_000)

  return {
    id: 'fixture-sleep',
    user_id: 'fixture-pro',
    professionista_id: 'fixture-pro',
    client_id: 'fixture-client',
    monitoring_type: 'sleep',
    source: 'external_device',
    device_name: 'Checkme O2 Max',
    device_serial: 'SIM-2024',
    sample_interval_seconds: SLEEP_DT,
    start_time: iso(startMs),
    end_time: iso(endMs),
    tz_offset_minutes: TZ,
    duration_minutes: minutes,
    rr_count: null,
    artifact_percentage: null,
    signal_quality: 'good',
    ectopic_count: null,
    valid_coverage_percentage: 100,
    algorithm_version: 'sleep-1.0.0',
    rr_storage_path: null,
    spo2_storage_path: null,
    notes: null,
    tags: [],
    created_at: now,
    updated_at: now,
    recording_profile: null,
    events_modified_on_web: false,
    client_name: clientName(),
    professional_name: null,
    events: [],
    windows,
    sleep_score: total,
    night: {
      night_start: iso(startMs),
      night_end: iso(endMs),
      detected: false,
      duration_minutes: minutes,
      mean_hr_night: cardiac.mean_pr,
      min_hr_night: cardiac.min_pr,
      min_hr_time: cardiac.min_pr_time,
      awakenings_estimate: movement.estimated_awakenings,
      sleep: {
        algorithm_version: 'sleep-1.0.0',
        analyzable: true,
        not_analyzable_reason: null,
        signal: {
          sample_interval_sec: SLEEP_DT,
          sample_count: n,
          valid_sample_count: n,
          coverage_pct: 100,
          coverage_label: 'good',
          invalid_segments: [],
          valid_recording_minutes: validMin,
          valid_time_minutes: validMin,
        },
        oxygenation,
        events,
        cardiac,
        movement,
        hourly,
        device: {
          o2_score: 78,
          avg_spo2: Math.round(oxygenation.mean_spo2),
          min_spo2: oxygenation.nadir,
          drops_3: desats.filter((d) => d.depth >= 3).length,
          drops_4: desats.filter((d) => d.depth >= 4).length,
          duration_below_90_sec: Math.round(t90m * 60),
          asleep_time_sec: minutes * 60,
          steps: null,
        },
      },
    },
    summary: {
      summary_phrase: phrase,
      sleep_score: score,
      odi3,
      odi3_label: oxygenation.odi3_label,
      t90_pct: oxygenation.t90_pct,
      t90_label: oxygenation.t90_label,
      coverage_pct: 100,
      analyzable: true,
    },
  }
}

function sleepPhrase(lang: Lang, v: { odi3: number; mean: number; trendDown: boolean }): string {
  const m = String(v.mean).replace('.', lang === 'en' ? '.' : ',')
  switch (lang) {
    case 'en':
      return `Night with light, regular oxygen drops (about ${v.odi3} per hour) and a mean oxygenation of ${m} %. ${v.trendDown ? 'The pulse fell over the night: cardiac recovery is good.' : 'The pulse did not fall over the night.'}`
    case 'de':
      return `Nacht mit leichten, regelmäßigen Sauerstoffabfällen (etwa ${v.odi3} pro Stunde) und einer mittleren Sauerstoffsättigung von ${m} %. ${v.trendDown ? 'Der Puls sank im Verlauf der Nacht: Die kardiale Erholung ist gut.' : 'Der Puls sank im Verlauf der Nacht nicht.'}`
    default:
      return `Notte con cali di ossigeno lievi e regolari (circa ${v.odi3} all'ora) e ossigenazione media del ${m} %. ${v.trendDown ? 'Il polso è sceso nel corso della notte: il recupero cardiaco è buono.' : 'Il polso non è sceso nel corso della notte.'}`
  }
}

// ── 24h: giornata del simulatore dell'app (inizio 15:00, ciclo completo) ─────

const DAY_START_HOUR = 15
const DAY_DAY = '2026-09-14'
const HR_MAX = 178

/** Profilo di un istante della giornata simulata (MonitoringSimulator.profileAt). */
function profileAt(hoursFromStart: number): { hr: number; rmssd: number } {
  const clock = (DAY_START_HOUR + hoursFromStart) % 24
  let hr: number
  let rmssd: number
  const isNight = clock >= 23 || clock < 7
  if (isNight) {
    const t = clock >= 23 ? clock - 23 : clock + 1
    const depth = Math.sin((Math.PI * t) / 8)
    hr = 58 - 8 * depth
    rmssd = 45 + 30 * depth
  } else {
    hr = 70 + 4 * Math.sin((Math.PI * (clock - 7)) / 16)
    rmssd = 32 - 6 * Math.sin((Math.PI * (clock - 7)) / 16)
  }
  if (clock >= 15.5 && clock < 17) { hr += 10; rmssd *= 0.55 }
  if (clock >= 17.5 && clock < 18.25) {
    const t = (clock - 17.5) / 0.75
    hr = 110 + 40 * Math.sin(Math.PI * t)
    rmssd = 6
  } else if (clock >= 8.5 && clock < 9) {
    hr = 115
    rmssd = 9
  }
  if (clock >= 21 && clock < 21.5) { hr -= 6; rmssd *= 1.5 }
  return { hr, rmssd }
}

const EVENT_LABEL: Record<Lang, Partial<Record<MonitoringEventType, string>>> = {
  it: { coffee: 'Caffè', training: 'Allenamento', meal: 'Pasto', relax: 'Rilassamento', sleep_start: 'Vado a dormire', wake_up: 'Mi sono svegliato' },
  en: { coffee: 'Coffee', training: 'Training', meal: 'Meal', relax: 'Relaxation', sleep_start: 'Going to sleep', wake_up: 'I woke up' },
  de: { coffee: 'Kaffee', training: 'Training', meal: 'Mahlzeit', relax: 'Entspannung', sleep_start: 'Ich gehe schlafen', wake_up: 'Ich bin aufgewacht' },
}
const EVENT_NOTE: Record<Lang, { coffee: string; meal: string }> = {
  it: { coffee: 'Espresso', meal: 'Cena' },
  en: { coffee: 'Espresso', meal: 'Dinner' },
  de: { coffee: 'Espresso', meal: 'Abendessen' },
}

export function fixtureMonitoring24hSession(lang: Lang = 'it'): Monitoring24hSession {
  const r = rng(42)
  const gauss = gaussOf(r)
  const startMs = localMs(DAY_DAY, DAY_START_HOUR)
  const minutes = 24 * 60
  const at = (min: number) => startMs + min * 60_000
  const clockOf = (min: number) => (DAY_START_HOUR + min / 60) % 24

  // Finestre mobili di 5 min a passo 1 min; fascia staccata 20:00-20:06.
  type Raw = { hr: number; rmssd: number; valid: boolean; activity: boolean; art: number }
  const raw: Raw[] = []
  for (let m = 0; m < minutes; m++) {
    const c0 = clockOf(m), c1 = clockOf(m + 5)
    const gap = (c0 >= 20 && c0 < 20.1) || (c1 >= 20 && c1 < 20.1) || (c0 < 20 && c1 >= 20.1 && c1 - c0 < 1)
    const p = profileAt((m + 2.5) / 60)
    const hr = p.hr + gauss() * 1.2
    const rmssd = Math.max(4, p.rmssd * (1 + gauss() * 0.12))
    raw.push({ hr, rmssd, valid: !gap, activity: false, art: Math.abs(gauss()) * 1.2 })
  }
  const validRaw = raw.filter((w) => w.valid)
  const hrRest = Math.round(percentile(validRaw.map((w) => w.hr), 0.05))
  const activityThreshold = hrRest + 0.35 * (HR_MAX - hrRest)
  for (const w of raw) w.activity = w.valid && w.hr > activityThreshold
  const quiet = validRaw.filter((w) => !w.activity)
  const lnRef = median(quiet.map((w) => Math.log(w.rmssd)))
  const mad = 1.4826 * median(quiet.map((w) => Math.abs(Math.log(w.rmssd) - lnRef)))
  const hrMedian = median(quiet.map((w) => w.hr))

  const windows: MonitoringWindow[] = raw.map((w, m) => {
    const s = iso(at(m)), e = iso(at(m + 5))
    if (!w.valid) return { s, e, valid: false, state: 'invalid', art: null, cov: 0, hr: null, hr_min: null, hr_max: null, rmssd: null, ln_rmssd: null, sdnn: null, pnn50: null, lf_hf: null, hf_nu: null, si: null, dfa: null, br: null }
    const ln = Math.log(w.rmssd)
    let state: MonitoringState = 'neutral'
    if (w.activity) state = 'activity'
    else if (ln > lnRef + 0.5 * mad && w.hr < hrMedian) state = 'recovery'
    else if (ln < lnRef - 0.5 * mad && w.hr > hrMedian) state = 'stress'
    const lfhf = clamp(1.2 + (w.hr - 60) * 0.05 + gauss() * 0.3, 0.3, 6)
    return {
      s, e, valid: true, state,
      art: r1(w.art), cov: 1,
      hr: r1(w.hr), hr_min: Math.round(w.hr - 4 - r() * 4), hr_max: Math.round(w.hr + 4 + r() * 4),
      rmssd: r1(w.rmssd), ln_rmssd: r2(ln),
      sdnn: r1(w.rmssd * 1.35 + gauss() * 2),
      pnn50: r1(clamp((w.rmssd - 15) * 1.1, 0, 80)),
      lf_hf: r2(lfhf), hf_nu: r1(clamp(100 / (1 + lfhf), 10, 90)),
      si: Math.round(clamp(60 + (w.hr - 60) * 4 - (w.rmssd - 30) * 1.5 + gauss() * 8, 15, 400)),
      dfa: m % 5 === 0 ? r2(clamp(0.75 + (w.activity ? 0.4 : 0) + (state === 'recovery' ? -0.1 : 0) + gauss() * 0.08, 0.3, 1.6)) : null,
      br: Math.round(clamp(12 + (w.hr - 60) * 0.15 + gauss() * 0.8, 8, 30)),
    }
  })

  // Notte 23:00-07:00 (minuti 480-960 dall'inizio).
  const nightStart = 480, nightEnd = 960
  const inNight = (m: number) => m >= nightStart && m < nightEnd
  const nightWins = windows.slice(nightStart, nightEnd)
  const nightHourly: MonitoringNightHour[] = []
  for (let h = 0; h < 8; h++) {
    const ws = nightWins.slice(h * 60, (h + 1) * 60).filter((w) => w.valid)
    nightHourly.push({ hour_start: iso(at(nightStart + h * 60)), mean_hr: r1(mean(ws.map((w) => w.hr ?? 0))), rmssd: r1(mean(ws.map((w) => w.rmssd ?? 0))), state: prevalent(ws) })
  }
  const nightValid = nightWins.filter((w) => w.valid)
  const minHrWin = nightValid.reduce((a, b) => ((b.hr ?? 999) < (a.hr ?? 999) ? b : a))
  const wakeQuiet = windows.filter((w, m) => w.valid && !inNight(m) && w.state !== 'activity')
  const hrWake = mean(wakeQuiet.map((w) => w.hr ?? 0))
  const hrNight = mean(nightValid.map((w) => w.hr ?? 0))
  const recFirst3 = pctState(nightWins.slice(0, 180), 'recovery')
  const recLast3 = pctState(nightWins.slice(-180), 'recovery')
  const night: MonitoringNight = {
    night_start: iso(at(nightStart)),
    night_end: iso(at(nightEnd)),
    detected: true,
    duration_minutes: nightEnd - nightStart,
    mean_hr_night: r1(hrNight),
    min_hr_night: minHrWin.hr,
    min_hr_time: minHrWin.s,
    rmssd_mean_night: r1(mean(nightValid.map((w) => w.rmssd ?? 0))),
    ln_rmssd_night: r2(mean(nightValid.map((w) => w.ln_rmssd ?? 0))),
    sdnn_night: r1(mean(nightValid.map((w) => w.sdnn ?? 0))),
    hr_dip_percentage: r1(((hrWake - hrNight) / hrWake) * 100),
    hourly: nightHourly,
    recovery_first_3h: r1(recFirst3),
    recovery_last_3h: r1(recLast3),
    recovery_trend: r1(recLast3 - recFirst3),
    recovery_percentage_night: r1(pctState(nightWins, 'recovery')),
    awakenings_estimate: 2,
  }

  // Ripartizione, bout, picco.
  const count = (st: MonitoringState) => windows.filter((w) => w.state === st).length
  const pctOf = (st: MonitoringState) => r1((count(st) / minutes) * 100)
  const bouts = (st: MonitoringState, range?: [number, number]) => boutsOf(windows, st, at, range)
  const recDay = bouts('recovery', [0, nightStart]).concat(bouts('recovery', [nightEnd, minutes]))
  const strDay = bouts('stress', [0, nightStart]).concat(bouts('stress', [nightEnd, minutes]))
  const longest = (bs: MonitoringBout[]) => (bs.length ? bs.reduce((a, b) => (b.minutes > a.minutes ? b : a)) : null)
  const peakWin = windows.filter((w) => w.valid && w.state !== 'activity').reduce((a, b) => ((b.ln_rmssd ?? 99) < (a.ln_rmssd ?? 99) ? b : a))
  const recMin = count('recovery'), strMin = count('stress')
  const balance = Math.round(50 + (50 * (recMin - strMin)) / Math.max(1, recMin + strMin))
  const balanceLabelIt = balance < 30 ? 'Attivazione prevalente' : balance < 45 ? "Tendenza all'attivazione" : balance <= 55 ? 'Equilibrio' : balance <= 70 ? 'Tendenza al recupero' : 'Recupero prevalente'
  const nightQuality = Math.round(clamp(55 + (night.recovery_percentage_night ?? 0) * 0.3 + ((night.hr_dip_percentage ?? 0) >= 10 ? 10 : 0), 0, 100))

  // Riserva: somma cumulativa dello scarto di ln RMSSD, campionata ogni 5 min.
  const reserve = reserveCurve(windows, lnRef, at)

  // Pause di recupero (bout di almeno 5 min fuori dalla notte) e tratto più lungo senza pause.
  const pauseItems = recDay.filter((b) => b.minutes >= 5)
  const pauses: RecoveryPauses = { count: pauseItems.length, total_min: pauseItems.reduce((a, b) => a + b.minutes, 0), items: pauseItems }
  const longestStretch = longestGap(pauseItems, at, [[0, nightStart], [nightEnd, minutes]])

  // Tempo di rientro dopo i tratti di attivazione di almeno 10 min.
  const returnTimes = returnTimesOf(windows, strDay.filter((b) => b.minutes >= 10), at)

  // Mappa delle ore (24 ore piene dell'orologio).
  const hourly: HourPattern[] = []
  for (let h = 0; h < 24; h++) {
    const ws = windows.slice(h * 60, (h + 1) * 60).filter((w) => w.valid)
    hourly.push({
      h: iso(at(h * 60)),
      hr: ws.length ? r1(median(ws.map((w) => w.hr ?? 0))) : null,
      ln: ws.length ? r2(median(ws.map((w) => w.ln_rmssd ?? 0))) : null,
      lfhf: ws.length ? r2(median(ws.map((w) => w.lf_hf ?? 0))) : null,
      state: ws.length ? prevalent(ws) : 'invalid',
      n: ws.length,
    })
  }

  // Orologio interno (cosinor sui valori orari).
  const cosinorHr = cosinorOf(hourly.map((x) => x.hr), (h) => clockOf(h * 60) + 0.5, 0.86)
  const cosinorLn = cosinorOf(hourly.map((x) => x.ln), (h) => clockOf(h * 60) + 0.5, 0.81, 2)

  // Tempo di discesa della notte.
  const ttmMin = nightWins.indexOf(minHrWin)
  const descent: Array<[number, number | null]> = []
  for (let k = 0; k * 10 <= ttmMin; k++) {
    const ws = nightWins.slice(k * 10, k * 10 + 10).filter((w) => w.valid)
    descent.push([k * 10, ws.length ? r1(mean(ws.map((w) => w.hr ?? 0))) : null])
  }

  const events = buildEvents(lang, windows, at, mad)

  const series = (ws: MonitoringWindow[], mins: number, full: boolean): SeriesHrv => {
    const v = ws.filter((w) => w.valid)
    const rm = mean(v.map((w) => w.rmssd ?? 0))
    const sdn = mean(v.map((w) => w.sdnn ?? 0)) * 1.6
    const lfhf = mean(v.map((w) => w.lf_hf ?? 0))
    const hf = Math.round(rm * rm * 0.55), lf = Math.round(hf * lfhf), vlf = Math.round(sdn * sdn * 0.35)
    const out: SeriesHrv = {
      rr_count: Math.round(mins * mean(v.map((w) => w.hr ?? 0))),
      minutes: mins,
      mean_hr: r1(mean(v.map((w) => w.hr ?? 0))),
      rmssd: r1(rm),
      sdnn: r1(sdn),
      pnn50: r1(mean(v.map((w) => w.pnn50 ?? 0))),
      lf_hf: r2(lfhf),
      lf_nu: r1((lf / (lf + hf)) * 100),
      hf_nu: r1((hf / (lf + hf)) * 100),
      total_power: vlf + lf + hf + (full ? 1800 : 0),
      si: Math.round(mean(v.map((w) => w.si ?? 0))),
      dfa_alpha1: r2(mean(v.map((w) => w.dfa).filter((x): x is number => x != null))),
      sd1: r1(rm / Math.SQRT2),
      sd2: r1(sdn * 1.4),
      dfa_alpha2: full ? 0.92 : null,
      ulf: full ? 1800 : null,
      vlf, lf, hf,
      tracts: full ? 2 : 1,
      tract_minutes: mins,
    }
    return out
  }

  const summary: MonitoringSummary = {
    percent_stress: pctOf('stress'),
    percent_recovery: pctOf('recovery'),
    percent_activity: pctOf('activity'),
    percent_neutral: pctOf('neutral'),
    percent_invalid: pctOf('invalid'),
    recovery_minutes_day: recDay.reduce((a, b) => a + b.minutes, 0),
    stress_minutes_day: strDay.reduce((a, b) => a + b.minutes, 0),
    longest_stress_bout: longest(bouts('stress')),
    longest_recovery_bout: longest(bouts('recovery')),
    peak_stress_time: iso(new Date(peakWin.s).getTime() + 2.5 * 60_000),
    mean_hr_24h: r1(mean(validRaw.map((w) => w.hr))),
    rmssd_mean_24h: r1(mean(validRaw.map((w) => w.rmssd))),
    hr_rest: hrRest,
    hr_max_used: HR_MAX,
    stress_recovery_balance: balance,
    stress_recovery_label: balanceLabelIt,
    night_recovery_quality: nightQuality,
    summary_phrase: dayPhrase(lang, { rec: Math.round(pctOf('recovery')), str: Math.round(pctOf('stress')), dip: Math.round(night.hr_dip_percentage ?? 0), pauses: pauses.count }),
    ln_rmssd_reference: r2(lnRef),
    ln_rmssd_mad: r2(mad * 1000) / 1000,
    hr_median: r1(hrMedian),
    activity_threshold_hr: Math.round(activityThreshold),
    series: {
      full: series(windows, 1434, true),
      night: series(nightWins, nightEnd - nightStart, false),
      day: series(windows.filter((_, m) => !inNight(m)), 954, false),
    },
    gap_minutes: 6,
    clock_shortfall_minutes: 0,
    advanced: {
      tracts: { count: 2, longest_min: 1134, total_min: 1434 },
      reserve,
      pauses,
      longest_stretch: longestStretch,
      return_times: returnTimes,
      prsa: {
        dc: 7.9,
        ac: -8.6,
        n_dec: 21140,
        n_acc: 20630,
        beats: 98020,
        curve_dec: [846, 847, 847, 848, 849, 851, 854, 860, 867, 864, 860, 857, 855, 853, 852],
        curve_acc: [858, 857, 856, 855, 853, 851, 848, 841, 834, 838, 842, 845, 847, 848, 849],
      },
      fragmentation: { pip: 38.5, ials: 0.62, pss: 55.2, pas: 12.1, beats: 98020 },
      respiration: { day: 14.2, night: 12.1, all: 13.5, sd: 1.4, n: 1380 },
      time_to_min: { min: ttmMin, at: minHrWin.s, hr: minHrWin.hr, descent },
      ultradian: { present: true, period: 92, cycles: 4.8, strength: 0.34 },
      cosinor_hr: cosinorHr,
      cosinor_ln_rmssd: cosinorLn,
      mse: { e: [1.62, 1.58, 1.55, 1.51, 1.48, 1.44, 1.41, 1.38, 1.35, 1.33, 1.3, 1.28, 1.26, 1.24, 1.22, 1.2, 1.19, 1.17, 1.16, 1.15], ci: 27.2, beats: 98020, chunks: 4 },
      dfa_alpha2: 0.92,
      hourly,
      unavailable: {},
      unreliable: [],
    },
  }

  const scoresNight: MonitoringScores = { stress: 32, recovery: 71, balance: 66, energy: 63, inflammation: 68, composite: 67.2 }
  const scoresMorning: MonitoringScores = { stress: 38, recovery: 64, balance: 61, energy: 60, inflammation: 66, composite: 62.6 }
  const baseline: BaselineSnapshot = { metric: 'ln_rmssd', mean: 3.68, sd: 0.21, swc: 0.1, rolling_7d: 3.71, n: 12, source: 'db', applied: true, reason: null }
  const endMs = at(minutes)
  const now = iso(endMs + 3_600_000)

  return {
    id: 'fixture-24h',
    user_id: 'fixture-pro',
    professionista_id: 'fixture-pro',
    client_id: 'fixture-client',
    monitoring_type: '24h',
    source: 'polar_h10_offline',
    device_name: 'Polar H10',
    start_time: iso(startMs),
    end_time: iso(endMs),
    tz_offset_minutes: TZ,
    duration_minutes: minutes,
    rr_count: 98020,
    artifact_percentage: 1.2,
    signal_quality: 'good',
    ectopic_count: 14,
    valid_coverage_percentage: r1((validRaw.length / minutes) * 100),
    algorithm_version: '1.1.0',
    rr_storage_path: null,
    notes: null,
    tags: [],
    created_at: now,
    updated_at: now,
    recording_profile: 'ciclo_completo',
    events_modified_on_web: false,
    client_name: clientName(),
    professional_name: null,
    events,
    windows,
    night,
    summary,
    scores_night: scoresNight,
    scores_morning: scoresMorning,
    baseline_snapshot: baseline,
  }
}

function dayPhrase(lang: Lang, v: { rec: number; str: number; dip: number; pauses: number }): string {
  switch (lang) {
    case 'en':
      return `Recovery took ${v.rec} % of the period and activation ${v.str} %. The night brought a heart rate dip of ${v.dip} % and during the day the body found ${v.pauses} real recovery pauses.`
    case 'de':
      return `Die Erholung nahm ${v.rec} % des Zeitraums ein, die Aktivierung ${v.str} %. In der Nacht sank die Herzfrequenz um ${v.dip} %, und tagsüber fand der Körper ${v.pauses} echte Erholungspausen.`
    default:
      return `Il recupero ha occupato il ${v.rec} % del periodo e l'attivazione il ${v.str} %. La notte ha portato un calo del battito del ${v.dip} % e di giorno il corpo ha trovato ${v.pauses} pause di recupero vere.`
  }
}

function prevalent(ws: MonitoringWindow[]): MonitoringState {
  const c: Partial<Record<MonitoringState, number>> = {}
  for (const w of ws) c[w.state] = (c[w.state] ?? 0) + 1
  let best: MonitoringState = 'neutral'
  let n = -1
  for (const st of ['recovery', 'stress', 'activity', 'neutral', 'invalid'] as MonitoringState[]) if ((c[st] ?? 0) > n) { n = c[st] ?? 0; best = st }
  return best
}

function pctState(ws: MonitoringWindow[], st: MonitoringState): number {
  return ws.length ? (ws.filter((w) => w.state === st).length / ws.length) * 100 : 0
}

function boutsOf(windows: MonitoringWindow[], st: MonitoringState, at: (m: number) => number, range?: [number, number]): MonitoringBout[] {
  const [a, b] = range ?? [0, windows.length]
  const out: MonitoringBout[] = []
  let start = -1
  for (let m = a; m <= b; m++) {
    const on = m < b && windows[m].state === st
    if (on && start < 0) start = m
    if (!on && start >= 0) { out.push({ start: iso(at(start)), end: iso(at(m)), minutes: m - start }); start = -1 }
  }
  return out
}

function longestGap(pauses: MonitoringBout[], at: (m: number) => number, wake: Array<[number, number]>): MonitoringBout | null {
  let best: MonitoringBout | null = null
  for (const [a, b] of wake) {
    const edges = [a, ...pauses.map((p) => (new Date(p.start).getTime() - at(0)) / 60_000).filter((m) => m >= a && m < b), b]
    const ends = [a, ...pauses.map((p) => (new Date(p.end).getTime() - at(0)) / 60_000).filter((m) => m > a && m <= b)]
    for (let i = 0; i + 1 < edges.length; i++) {
      const from = i === 0 ? a : ends[i]
      const to = edges[i + 1]
      const mins = Math.round(to - from)
      if (!best || mins > best.minutes) best = { start: iso(at(from)), end: iso(at(to)), minutes: mins }
    }
  }
  return best
}

function returnTimesOf(windows: MonitoringWindow[], bouts: MonitoringBout[], at: (m: number) => number): ReturnTimes {
  const items = bouts.map((b) => {
    const end = Math.round((new Date(b.end).getTime() - at(0)) / 60_000)
    let k = end
    while (k < windows.length && !(windows[k].valid && (windows[k].state === 'neutral' || windows[k].state === 'recovery'))) k++
    const ok = k < windows.length
    return { s: b.end, e: iso(at(ok ? k : windows.length)), min: (ok ? k : windows.length) - end, ok }
  })
  const okItems = items.filter((i) => i.ok)
  const worst = okItems.length ? okItems.reduce((a, b) => (b.min > a.min ? b : a)) : null
  return { median: okItems.length ? Math.round(median(okItems.map((i) => i.min))) : null, worst: worst?.min ?? null, worst_at: worst?.s ?? null, items }
}

function reserveCurve(windows: MonitoringWindow[], lnRef: number, at: (m: number) => number): ReserveCurve {
  let acc = 0
  const pts: Array<[string, number | null]> = []
  let min = 0, max = 0, minT: string | null = null, maxT: string | null = null
  windows.forEach((w, m) => {
    if (w.valid && w.ln_rmssd != null) {
      const d = w.ln_rmssd - lnRef
      if (w.state === 'recovery') acc += Math.max(0, d)
      else if (w.state === 'stress') acc += Math.min(0, d)
    }
    if (m % 5 === 0) {
      const v = r2(acc)
      pts.push([iso(at(m)), v])
      if (v < min) { min = v; minT = iso(at(m)) }
      if (v > max) { max = v; maxT = iso(at(m)) }
    }
  })
  return { pts, start: 0, end: pts[pts.length - 1]?.[1] ?? 0, min, min_t: minT, max, max_t: maxT }
}

function cosinorOf(vals: Array<number | null>, clockOfIndex: (i: number) => number, r2v: number, digits = 1): CosinorSummary {
  const pts = vals.map((v, i) => (v == null ? null : { t: clockOfIndex(i), v })).filter((p): p is { t: number; v: number } => p != null)
  const m = mean(pts.map((p) => p.v))
  let a = 0, b = 0
  for (const p of pts) { a += (p.v - m) * Math.cos((2 * Math.PI * p.t) / 24); b += (p.v - m) * Math.sin((2 * Math.PI * p.t) / 24) }
  a = (2 * a) / pts.length; b = (2 * b) / pts.length
  const amp = Math.sqrt(a * a + b * b)
  let acro = (Math.atan2(b, a) * 24) / (2 * Math.PI)
  if (acro < 0) acro += 24
  const f = digits === 2 ? r2 : r1
  return { mesor: f(m), amp: f(amp), acro: r1(acro), bathy: r1((acro + 12) % 24), r2: r2v, hours: pts.length, indicative: false }
}

function buildEvents(lang: Lang, windows: MonitoringWindow[], at: (m: number) => number, mad: number): MonitoringEvent[] {
  const minuteOf = (clock: number) => { let d = clock - DAY_START_HOUR; if (d < 0) d += 24; return Math.round(d * 60) }
  const specs: Array<{ id: string; type: MonitoringEventType; clock: number; note?: string }> = [
    { id: 'sim-coffee', type: 'coffee', clock: 15.4, note: EVENT_NOTE[lang].coffee },
    { id: 'sim-training', type: 'training', clock: 17.5 },
    { id: 'sim-meal', type: 'meal', clock: 19.5, note: EVENT_NOTE[lang].meal },
    { id: 'sim-relax', type: 'relax', clock: 21.0 },
    { id: 'sim-sleep', type: 'sleep_start', clock: 23.0 },
    { id: 'sim-wake', type: 'wake_up', clock: 7.0 },
    { id: 'sim-coffee2', type: 'coffee', clock: 7.5 },
  ]
  const usable = (w: MonitoringWindow) => w.valid && w.state !== 'activity'
  const avg = (ws: MonitoringWindow[], pick: (w: MonitoringWindow) => number | null) => {
    const v = ws.map(pick).filter((x): x is number => x != null)
    return v.length ? mean(v) : null
  }
  return specs.map((sp) => {
    const m = minuteOf(sp.clock)
    const marker = sp.type === 'sleep_start' || sp.type === 'wake_up'
    let response: EventResponse | null = null
    if (!marker) {
      const before = windows.slice(Math.max(0, m - 60), m).filter(usable)
      const after = windows.slice(m, m + 60).filter(usable)
      const late = windows.slice(m + 60, m + 180).filter(usable)
      const hrB = avg(before, (w) => w.hr), hrA = avg(after, (w) => w.hr), hrL = avg(late, (w) => w.hr)
      const lnB = avg(before, (w) => w.ln_rmssd), lnA = avg(after, (w) => w.ln_rmssd), lnL = avg(late, (w) => w.ln_rmssd)
      const dLn = lnA != null && lnB != null ? lnA - lnB : null
      const enough = before.length >= 10 && after.length >= 10
      response = {
        label: !enough || dLn == null ? 'dati insufficienti' : dLn > 0.5 * mad ? 'recupero' : dLn < -0.5 * mad ? 'attivazione' : 'neutro',
        hr_before: hrB == null ? null : r1(hrB),
        hr_after: hrA == null ? null : r1(hrA),
        hr_late: hrL == null ? null : r1(hrL),
        ln_rmssd_before: lnB == null ? null : r2(lnB),
        ln_rmssd_after: lnA == null ? null : r2(lnA),
        ln_rmssd_late: lnL == null ? null : r2(lnL),
        delta_hr: hrA != null && hrB != null ? r1(hrA - hrB) : null,
        delta_hr_pct: hrA != null && hrB != null ? r1(((hrA - hrB) / hrB) * 100) : null,
        delta_ln_rmssd: dLn == null ? null : r2(dLn),
        delta_ln_rmssd_pct: dLn != null && lnB ? r1((dLn / lnB) * 100) : null,
        delta_hr_late: hrL != null && hrB != null ? r1(hrL - hrB) : null,
        delta_ln_rmssd_late: lnL != null && lnB != null ? r2(lnL - lnB) : null,
        n_before: before.length,
        n_after: after.length,
        n_late: late.length,
      }
    }
    return { id: sp.id, type: sp.type, timestamp: iso(at(m)), label: EVENT_LABEL[lang][sp.type] ?? sp.type, note: sp.note ?? null, response }
  })
}
