import { csvResponse, loadMonitoringForRoute, sanitizeFilename } from '@/lib/monitoring-access'
import { dayNumeric, wallDate } from '@/lib/monitoring-format'
import { isSleepSession } from '@/lib/monitoring-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function wall(iso: string, tz: number): string {
  const d = wallDate(iso, tz)
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

const v = (x: number | null | undefined) => (x == null ? '' : String(x))

// GET /api/monitoring/[id]/windows-csv — le finestre già calcolate dall'app
// (5 min / passo 1 min per il 24h, 1 min per il Sonno), così come salvate.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await loadMonitoringForRoute(params.id)
  if (access.error) return access.error
  const { session } = access
  const tz = session.tz_offset_minutes
  const lines: string[] = []
  if (isSleepSession(session)) {
    lines.push(['start_utc', 'end_utc', 'start_device', 'state', 'spo2_mean', 'spo2_min', 'pr_mean', 'movement', 'events_started'].join(','))
    for (const w of session.windows) lines.push([w.s, w.e, wall(w.s, tz), w.state, v(w.spo2), v(w.spo2_min), v(w.pr), v(w.mov), String(w.ev)].join(','))
  } else {
    lines.push(['start_utc', 'end_utc', 'start_device', 'valid', 'state', 'artifact_pct', 'coverage', 'hr', 'hr_min', 'hr_max', 'rmssd', 'ln_rmssd', 'sdnn', 'pnn50', 'lf_hf', 'hf_nu', 'baevsky_si', 'dfa_alpha1', 'breathing_est'].join(','))
    for (const w of session.windows) {
      lines.push([w.s, w.e, wall(w.s, tz), w.valid ? '1' : '0', w.state, v(w.art), v(w.cov), v(w.hr), v(w.hr_min), v(w.hr_max), v(w.rmssd), v(w.ln_rmssd), v(w.sdnn), v(w.pnn50), v(w.lf_hf), v(w.hf_nu), v(w.si), v(w.dfa), v(w.br)].join(','))
    }
  }
  const who = sanitizeFilename(session.client_name ?? 'cliente')
  const date = dayNumeric(session.start_time, tz).split('/').reverse().join('-')
  return csvResponse(lines.join('\n'), `StressIndex_${isSleepSession(session) ? 'Sonno' : 'Finestre'}_${who}_${date}.csv`)
}
