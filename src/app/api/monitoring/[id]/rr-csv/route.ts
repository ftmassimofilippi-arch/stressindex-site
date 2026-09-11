import { NextResponse } from 'next/server'
import { csvResponse, loadMonitoringForRoute, sanitizeFilename } from '@/lib/monitoring-access'
import { readRrFile } from '@/lib/monitoring-data'
import { dayNumeric } from '@/lib/monitoring-format'
import { isSleepSession } from '@/lib/monitoring-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/monitoring/[id]/rr-csv — RR grezzi dal bucket monitoring-rr
// (URL firmata a breve scadenza generata lato server), convertiti in CSV.
// Solo export: il sito non calcola nulla da questi dati.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await loadMonitoringForRoute(params.id)
  if (access.error) return access.error
  const { session } = access
  if (isSleepSession(session) || !session.rr_storage_path) {
    return NextResponse.json({ error: 'Questo monitoraggio non ha un file RR nel bucket.' }, { status: 404 })
  }
  const file = await readRrFile(session)
  if (!file) return NextResponse.json({ error: 'File RR non leggibile: verifica che il caricamento dall\'app sia andato a buon fine.' }, { status: 502 })

  const startMs = new Date(file.start_time).getTime()
  const tz = file.tz_offset_minutes ?? session.tz_offset_minutes
  const hasT = Array.isArray(file.t_ms) && file.t_ms.length === file.rr_ms.length
  const lines: string[] = [`# session_id=${file.session_id};start_time_utc=${file.start_time};tz_offset_minutes=${tz};raw_count=${file.raw_count};timestamps=${hasT ? 'device (t_ms)' : 'cumulative sum of RR (H10 memory)'}`]
  lines.push(['index', 'rr_ms', 't_ms_from_start', 'timestamp_utc', 'wall_clock_device'].join(','))
  let cum = 0
  for (let i = 0; i < file.rr_ms.length; i++) {
    const rr = file.rr_ms[i]
    cum += rr
    const t = hasT ? file.t_ms![i] : cum
    const inst = new Date(startMs + t)
    const wall = new Date(inst.getTime() + tz * 60_000)
    const w = `${wall.getUTCFullYear()}-${String(wall.getUTCMonth() + 1).padStart(2, '0')}-${String(wall.getUTCDate()).padStart(2, '0')} ${String(wall.getUTCHours()).padStart(2, '0')}:${String(wall.getUTCMinutes()).padStart(2, '0')}:${String(wall.getUTCSeconds()).padStart(2, '0')}.${String(wall.getUTCMilliseconds()).padStart(3, '0')}`
    lines.push(`${i},${rr},${t},${inst.toISOString()},${w}`)
  }
  const who = sanitizeFilename(session.client_name ?? 'cliente')
  const date = dayNumeric(session.start_time, session.tz_offset_minutes).split('/').reverse().join('-')
  return csvResponse(lines.join('\n'), `StressIndex_RR_${who}_${date}.csv`)
}
