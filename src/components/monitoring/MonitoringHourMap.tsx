import { useLocale, useTranslations } from 'next-intl'
import type { HourPattern } from '@/lib/monitoring-types'
import { MON, STATE_COLOR, fmtNum, hm, intensityColor, stateLabel } from '@/lib/monitoring-format'
import { monT, type Lang } from '@/lib/monitoring-strings'

// Mappa delle ore (C14, MonitoringHourMap dell'app): ore in ascissa, tre
// righe (HR, ln RMSSD, LF/HF) colorate per intensità relativa alla
// registrazione, e sotto lo stato prevalente dell'ora. Ore senza dati
// tratteggiate. Scroll orizzontale su mobile.
// `print`: la griglia si adatta alla larghezza della card (celle più strette).

export { intensityColor }

export function MonitoringHourMap({ hours, tz, pro = true, print = false }: { hours: HourPattern[]; tz: number; pro?: boolean; print?: boolean }) {
  const t = useTranslations('monitoring')
  const locale = useLocale() as Lang
  if (hours.length === 0) return null
  const rows: Array<{ label: string; pick: (h: HourPattern) => number | null; warm: boolean; fmt: (v: number) => string }> = [
    { label: 'HR', pick: (h) => h.hr, warm: true, fmt: (v) => `${Math.round(v)}` },
    { label: 'ln RMSSD', pick: (h) => h.ln, warm: false, fmt: (v) => fmtNum(v, 2, locale) },
    { label: 'LF/HF', pick: (h) => h.lfhf, warm: true, fmt: (v) => fmtNum(v, 2, locale) },
  ]
  const ranges = rows.map((r) => {
    const vals = hours.map(r.pick).filter((v): v is number => v != null)
    return vals.length ? { mn: Math.min(...vals), mx: Math.max(...vals) } : null
  })
  return (
    <div className="space-y-3">
      <div className={print ? '' : 'overflow-x-auto'}>
        <table className={`border-separate border-spacing-[2px] ${print ? 'w-full text-[8.5px]' : 'text-[10px]'}`} style={print ? undefined : { minWidth: Math.max(520, hours.length * 34 + 70) }}>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.label}>
                <th className="text-left pr-2 font-bold text-anthracite-lighter whitespace-nowrap">{r.label}</th>
                {hours.map((h, i) => {
                  const v = r.pick(h)
                  const rg = ranges[ri]
                  const color = v == null || !rg ? STATE_COLOR.invalid : intensityColor(rg.mx - rg.mn < 1e-9 ? 0.5 : (v - rg.mn) / (rg.mx - rg.mn), r.warm)
                  return (
                    <td key={i} className={`rounded-sm text-center tabular-nums ${print ? 'h-6 px-0' : 'h-7 min-w-[30px]'}`} style={{ backgroundColor: color, color: MON.textPrimary }} title={`${hm(h.h, tz)} · ${r.label} ${v == null ? '—' : r.fmt(v)}`}>
                      {v == null ? '' : r.fmt(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <th className="text-left pr-2 font-bold text-anthracite-lighter">{t('hourMap.state')}</th>
              {hours.map((h, i) => (
                <td
                  key={i}
                  className="rounded-sm h-5"
                  title={`${hm(h.h, tz)} · ${h.n === 0 ? t('hourMap.noData') : stateLabel(h.state, locale)} · ${t('hourMap.validWindows', { count: h.n })}`}
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
        <Leg color={intensityColor(0.1, true)} label={t('hourMap.legendLow')} />
        <Leg color={intensityColor(0.9, true)} label={t('hourMap.legendHigh')} />
        <Leg color={intensityColor(0.9, false)} label={t('hourMap.legendLnHigh')} />
        <Leg color={STATE_COLOR.recovery} label={stateLabel('recovery', locale)} />
        <Leg color={STATE_COLOR.stress} label={stateLabel('stress', locale)} />
        <Leg color={STATE_COLOR.activity} label={stateLabel('activity', locale)} />
      </div>
      <p className="text-[10.5px] text-anthracite-lighter">{monT('hour_map_note', locale)}</p>
      {pro && (
        <div className={print ? '' : 'overflow-x-auto'}>
          <table className={`w-full text-[11px] ${print ? '' : 'min-w-[420px]'}`}>
            <thead>
              <tr className="text-left" style={{ color: MON.accentDark }}>
                <th className="py-1 font-extrabold">{monT('ev_time', locale)}</th><th className="py-1 font-extrabold text-right">HR</th><th className="py-1 font-extrabold text-right">ln RMSSD</th><th className="py-1 font-extrabold text-right">LF/HF</th><th className="py-1 font-extrabold">{t('hourMap.state')}</th><th className="py-1 font-extrabold text-right">n</th>
              </tr>
            </thead>
            <tbody>
              {hours.map((h, i) => (
                <tr key={i} className="border-t border-surface-border">
                  <td className="py-1">{hm(h.h, tz)}</td>
                  <td className="py-1 text-right tabular-nums">{h.hr == null ? '—' : Math.round(h.hr)}</td>
                  <td className="py-1 text-right tabular-nums">{fmtNum(h.ln, 2, locale)}</td>
                  <td className="py-1 text-right tabular-nums">{fmtNum(h.lfhf, 2, locale)}</td>
                  <td className="py-1">{h.n === 0 ? '—' : stateLabel(h.state, locale)}</td>
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
  return <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />{label}</span>
}
