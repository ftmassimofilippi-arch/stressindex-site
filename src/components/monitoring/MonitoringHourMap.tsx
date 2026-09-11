import type { HourPattern } from '@/lib/monitoring-types'
import { MON, STATE_COLOR, STATE_LABEL, hm } from '@/lib/monitoring-format'

// Mappa delle ore (C14, MonitoringHourMap dell'app): ore in ascissa, tre
// righe (HR, ln RMSSD, LF/HF) colorate per intensità relativa alla
// registrazione, e sotto lo stato prevalente dell'ora. Ore senza dati
// tratteggiate. Scroll orizzontale su mobile.

function lerp(a: string, b: string, t: number): string {
  const pa = hex(a), pb = hex(b)
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
function hex(h: string): number[] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
}
/** Scala d'intensità: warm = verde tenue → rosso (HR, LF/HF); altrimenti grigio → verde (ln RMSSD). */
export function intensityColor(t: number, warm: boolean): string {
  return warm ? lerp('#DCEFE6', STATE_COLOR.stress, t) : lerp('#E6E9EC', STATE_COLOR.recovery, t)
}

export function MonitoringHourMap({ hours, tz, pro = true }: { hours: HourPattern[]; tz: number; pro?: boolean }) {
  if (hours.length === 0) return null
  const rows: Array<{ label: string; pick: (h: HourPattern) => number | null; warm: boolean; fmt: (v: number) => string }> = [
    { label: 'HR', pick: (h) => h.hr, warm: true, fmt: (v) => `${Math.round(v)}` },
    { label: 'ln RMSSD', pick: (h) => h.ln, warm: false, fmt: (v) => v.toFixed(2) },
    { label: 'LF/HF', pick: (h) => h.lfhf, warm: true, fmt: (v) => v.toFixed(2) },
  ]
  const ranges = rows.map((r) => {
    const vals = hours.map(r.pick).filter((v): v is number => v != null)
    return vals.length ? { mn: Math.min(...vals), mx: Math.max(...vals) } : null
  })
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[2px] text-[10px]" style={{ minWidth: Math.max(520, hours.length * 34 + 70) }}>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.label}>
                <th className="text-left pr-2 font-bold text-anthracite-lighter whitespace-nowrap">{r.label}</th>
                {hours.map((h, i) => {
                  const v = r.pick(h)
                  const rg = ranges[ri]
                  const color = v == null || !rg ? STATE_COLOR.invalid : intensityColor(rg.mx - rg.mn < 1e-9 ? 0.5 : (v - rg.mn) / (rg.mx - rg.mn), r.warm)
                  return (
                    <td key={i} className="rounded-sm text-center tabular-nums h-7 min-w-[30px]" style={{ backgroundColor: color, color: MON.textPrimary }} title={`${hm(h.h, tz)} · ${r.label} ${v == null ? '—' : r.fmt(v)}`}>
                      {v == null ? '' : r.fmt(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <th className="text-left pr-2 font-bold text-anthracite-lighter">Stato</th>
              {hours.map((h, i) => (
                <td
                  key={i}
                  className="rounded-sm h-5"
                  title={`${hm(h.h, tz)} · ${h.n === 0 ? 'nessun dato' : STATE_LABEL[h.state]} · ${h.n} finestre valide`}
                  style={h.n === 0
                    ? { backgroundImage: `repeating-linear-gradient(45deg, ${MON.borderMedium} 0 1px, ${STATE_COLOR.invalid} 1px 6px)` }
                    : { backgroundColor: STATE_COLOR[h.state] }}
                />
              ))}
            </tr>
            <tr>
              <th />
              {hours.map((h, i) => (
                <td key={i} className="text-center text-anthracite-lighter">{hours.length > 16 && i % 2 === 1 ? '' : String(new Date(new Date(h.h).getTime() + tz * 60_000).getUTCHours()).padStart(2, '0')}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-anthracite-lighter">
        <Leg color={intensityColor(0.1, true)} label="HR / LF/HF bassi" />
        <Leg color={intensityColor(0.9, true)} label="alti" />
        <Leg color={intensityColor(0.9, false)} label="ln RMSSD alto" />
        <Leg color={STATE_COLOR.recovery} label="Recupero" />
        <Leg color={STATE_COLOR.stress} label="Attivazione" />
        <Leg color={STATE_COLOR.activity} label="Attività" />
      </div>
      <p className="text-[10.5px] text-anthracite-lighter">Colori relativi a questa registrazione: più caldo = battito più alto o più attivazione; più verde = più recupero. Le ore tratteggiate non hanno dati.</p>
      {pro && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] min-w-[420px]">
            <thead>
              <tr className="text-left" style={{ color: MON.accentDark }}>
                <th className="py-1 font-extrabold">Ora</th><th className="py-1 font-extrabold text-right">HR</th><th className="py-1 font-extrabold text-right">ln RMSSD</th><th className="py-1 font-extrabold text-right">LF/HF</th><th className="py-1 font-extrabold">Stato</th><th className="py-1 font-extrabold text-right">n</th>
              </tr>
            </thead>
            <tbody>
              {hours.map((h, i) => (
                <tr key={i} className="border-t border-surface-border">
                  <td className="py-1">{hm(h.h, tz)}</td>
                  <td className="py-1 text-right tabular-nums">{h.hr == null ? '—' : Math.round(h.hr)}</td>
                  <td className="py-1 text-right tabular-nums">{h.ln == null ? '—' : h.ln.toFixed(2)}</td>
                  <td className="py-1 text-right tabular-nums">{h.lfhf == null ? '—' : h.lfhf.toFixed(2)}</td>
                  <td className="py-1">{h.n === 0 ? '—' : STATE_LABEL[h.state]}</td>
                  <td className="py-1 text-right tabular-nums">{h.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Leg({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />{label}</span>
}
