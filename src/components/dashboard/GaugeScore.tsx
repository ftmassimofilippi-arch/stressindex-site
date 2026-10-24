'use client'

// Tachimetro semicircolare identico a quello dell'app Flutter:
//  - Stress  → arco a 5 segmenti colorati fissi (verde→rosso scuro) + ago
//              (replica GaugePainter di stress_gauge.dart)
//  - Altri   → arco grigio di sfondo + riempimento proporzionale al valore
//              nel colore della zona + ago
//              (replica _MiniGaugePainter di proprietary_score_card.dart)
//  Sotto l'arco: numero grande, "/ 100", badge della zona.
//  Segmenti, tacche, colori ed etichette vengono tutti da `gauge-zones`
//  (confini dell'Appendice A: Stress 30/50/70/85, gli altri 25/45/65/85).

import { useLocale, useTranslations } from 'next-intl'
import { num } from '@/lib/format'

import { ZONES, zoneBounds, zoneFor, scoreDeltaTone, type GaugeColorScheme } from '@/lib/gauge-zones'
export type { GaugeColorScheme } from '@/lib/gauge-zones'

type Props = {
  value?: number | null // 0–100
  label: string // nome dello score, già tradotto (es. t('scores.names.stress'))
  colorScheme: GaugeColorScheme
  /** Variazione rispetto alla misurazione precedente (punti): se presente, riga "▲ +5" / "▼ -3" sotto il badge. */
  delta?: number | null
  /** Pagina di stampa: card a larghezza fissa (150 px), nessuna transizione. */
  print?: boolean
}

// Larghezza della card in stampa (px): quattro gauge affiancate in un A4.
export const GAUGE_PRINT_WIDTH = 150

// Palette allineata ad AppColors dell'app
const TRACK = '#E2E6EA' // AppColors.borderLight

// Segmenti dell'arco a colori fissi: uno per fascia di `gauge-zones`
// (per lo Stress: 0-30 verde, 30-50 giallo, 50-70 arancio, 70-85 rosso,
// 85-100 rosso scuro). Le tacche bianche cadono sui confini delle fasce.
function arcSegments(scheme: GaugeColorScheme): Array<{ start: number; end: number; color: string }> {
  let start = 0
  return ZONES[scheme].map((z) => {
    const end = Math.min(100, z.max)
    const seg = { start, end, color: z.color }
    start = end
    return seg
  })
}

// Punto sull'arco: 0 → estremo sinistro (180°), 100 → estremo destro (360°)
// Coordinate arrotondate a tre decimali: seno e coseno di Node (server) e del
// browser differiscono all'ultima cifra e React segnalava il `d` del path
// come mismatch di idratazione (12 errori per pagina, 3 per ogni gauge).
function polar(cx: number, cy: number, r: number, frac: number) {
  const a = Math.PI + frac * Math.PI
  return { x: Math.round((cx + r * Math.cos(a)) * 1000) / 1000, y: Math.round((cy + r * Math.sin(a)) * 1000) / 1000 }
}

function arcPath(cx: number, cy: number, r: number, fromFrac: number, toFrac: number) {
  const p0 = polar(cx, cy, r, fromFrac)
  const p1 = polar(cx, cy, r, toFrac)
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y}`
}

export function GaugeScore({ value, label, colorScheme, delta, print = false }: Props) {
  const locale = useLocale()
  const t = useTranslations('scores')
  const tCommon = useTranslations('common')
  const hasValue = value != null && Number.isFinite(value)
  const v = hasValue ? Math.max(0, Math.min(100, value as number)) : 0
  const zone = zoneFor(colorScheme, v)
  const zoneLabel = t(`bands.${colorScheme}.${zone.labelKey}`)

  // Variazione rispetto alla precedente: colore per verso del "meglio" dello
  // score (per lo Stress scendere è meglio); sotto SCORE_STABLE_DELTA (10
  // punti, decisione 9) la variazione è "stabile" e resta neutra.
  const hasDelta = hasValue && delta != null && Number.isFinite(delta)
  const d = hasDelta ? Math.round(delta as number) : 0
  const deltaText = d === 0 ? t('deltaUnchanged') : `${d > 0 ? '▲ +' : '▼ '}${num(d, 0, locale)}`
  const tone = scoreDeltaTone(colorScheme, d)
  const deltaTone = tone === 'better' ? 'text-emerald-700' : tone === 'worse' ? 'text-red-700' : 'text-anthracite-lighter'

  // Geometria (stesse proporzioni dei painter dell'app)
  const W = 200
  const cx = W / 2
  const r = 72
  const sw = r * 0.18
  const cy = r + sw / 2 + 4
  const H = cy + 14
  const frac = v / 100
  const needle = polar(cx, cy, r * 0.76, frac)

  return (
    <div
      className={`card flex flex-col items-center ${print ? 'p-3 flex-shrink-0 break-inside-avoid' : 'p-5'}`}
      style={print ? { width: GAUGE_PRINT_WIDTH, maxWidth: GAUGE_PRINT_WIDTH } : undefined}
    >
      <div className="text-xs font-medium text-anthracite-lighter uppercase tracking-wide text-center">{label}</div>

      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className={print ? 'mt-1 max-w-[126px]' : 'mt-2 max-w-[200px]'}
        role="img"
        aria-label={`${label}: ${t('outOf100', { n: hasValue ? Math.round(v) : '—' })}`}
      >
        {colorScheme === 'stress' ? (
          <>
            {/* Arco a segmenti colorati fissi (come GaugePainter), una fascia per segmento */}
            {arcSegments(colorScheme).map((s) => (
              <path
                key={s.start}
                d={arcPath(cx, cy, r, s.start / 100, s.end / 100)}
                stroke={hasValue ? s.color : TRACK}
                strokeWidth={sw}
                fill="none"
              />
            ))}
            {/* Linee di separazione tra le zone, sui confini delle fasce */}
            {hasValue &&
              zoneBounds(colorScheme).map((b) => {
                const inner = polar(cx, cy, r - sw / 2 - 1, b / 100)
                const outer = polar(cx, cy, r + sw / 2 + 1, b / 100)
                return (
                  <line
                    key={b}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                  />
                )
              })}
          </>
        ) : (
          <>
            {/* Arco di sfondo grigio + riempimento nel colore della zona */}
            <path d={arcPath(cx, cy, r, 0, 1)} stroke={TRACK} strokeWidth={sw} fill="none" />
            {hasValue && frac > 0 && (
              <path
                d={arcPath(cx, cy, r, 0, frac)}
                stroke={zone.color}
                strokeWidth={sw}
                fill="none"
                style={print ? undefined : { transition: 'all 0.5s ease' }}
              />
            )}
          </>
        )}

        {/* Ago + perno centrale (come nell'app) */}
        {hasValue && (
          <>
            <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#1F2933" strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={6} fill="#1F2933" />
            <circle cx={cx} cy={cy} r={3.5} fill="#FFFFFF" />
          </>
        )}

        {/* Etichette estremi 0 / 100 */}
        <text x={cx - r} y={cy + 12} textAnchor="middle" fontSize={9} fill="#8A94A0">0</text>
        <text x={cx + r} y={cy + 12} textAnchor="middle" fontSize={9} fill="#8A94A0">100</text>
      </svg>

      {/* Numero grande sotto l'arco */}
      <div className="mt-1 text-3xl font-serif text-anthracite leading-none">
        {hasValue ? Math.round(v) : '—'}
      </div>
      <div className="text-[10px] text-anthracite-lighter mt-0.5">/ 100</div>

      {/* Badge zona */}
      <div
        className="mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border max-w-full truncate text-center"
        style={
          hasValue
            ? {
                color: zone.color,
                backgroundColor: `${zone.color}1F`,
                borderColor: `${zone.color}66`,
              }
            : { color: '#8A94A0', backgroundColor: '#F2F4F6', borderColor: '#E2E6EA' }
        }
      >
        {hasValue ? zoneLabel : tCommon('noData')}
      </div>

      {/* Variazione rispetto alla misurazione precedente */}
      {hasDelta && (
        <div className={`mt-1.5 text-[11px] font-semibold tabular-nums ${deltaTone}`} title={t('deltaVsPrevious')}>
          <span aria-hidden>{deltaText}</span>
          <span className="sr-only">{`${d > 0 ? '+' : ''}${num(d, 0, locale)} ${t('deltaVsPrevious')}`}</span>
        </div>
      )}
    </div>
  )
}
