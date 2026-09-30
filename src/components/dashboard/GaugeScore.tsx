'use client'

// Tachimetro semicircolare identico a quello dell'app Flutter:
//  - Stress  → arco a 5 segmenti colorati fissi (verde→rosso) + ago
//              (replica GaugePainter di stress_gauge.dart)
//  - Altri   → arco grigio di sfondo + riempimento proporzionale al valore
//              nel colore della zona + ago
//              (replica _MiniGaugePainter di proprietary_score_card.dart)
//  Sotto l'arco: numero grande, "/ 100", badge della zona
//  (soglie da proprietary_scores.dart; etichette dal namespace `scores.bands`).

import { useLocale, useTranslations } from 'next-intl'
import { num } from '@/lib/format'

export type GaugeColorScheme = 'stress' | 'recovery' | 'balance' | 'energy' | 'adaptation'

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
const GREEN = '#2F8F6B' // AppColors.success
const YELLOW = '#C78A2C' // AppColors.warning
const ORANGE = '#E67E22'
const RED = '#C44E4E' // AppColors.error
const DARK_RED = '#A93226'
const TRACK = '#E2E6EA' // AppColors.borderLight

// `labelKey` è la chiave in `scores.bands.<scheme>`.
type Zone = { max: number; labelKey: string; color: string }

// Soglie identiche a proprietary_scores.dart (_stressZone, _recoveryZone, ...)
const ZONES: Record<GaugeColorScheme, Zone[]> = {
  stress: [
    { max: 30, labelKey: 'low', color: GREEN },
    { max: 50, labelKey: 'balance', color: YELLOW },
    { max: 70, labelKey: 'medium', color: ORANGE },
    { max: 85, labelKey: 'high', color: RED },
    { max: Infinity, labelKey: 'fatigue', color: DARK_RED },
  ],
  recovery: [
    { max: 25, labelKey: 'insufficient', color: RED },
    { max: 45, labelKey: 'poor', color: ORANGE },
    { max: 65, labelKey: 'moderate', color: YELLOW },
    { max: 85, labelKey: 'good', color: GREEN },
    { max: Infinity, labelKey: 'optimal', color: GREEN },
  ],
  balance: [
    { max: 25, labelKey: 'strongImbalance', color: RED },
    { max: 45, labelKey: 'moderateImbalance', color: ORANGE },
    { max: 65, labelKey: 'sufficient', color: YELLOW },
    { max: 85, labelKey: 'good', color: GREEN },
    { max: Infinity, labelKey: 'optimal', color: GREEN },
  ],
  energy: [
    { max: 25, labelKey: 'depleted', color: RED },
    { max: 45, labelKey: 'low', color: ORANGE },
    { max: 65, labelKey: 'moderate', color: YELLOW },
    { max: 85, labelKey: 'good', color: GREEN },
    { max: Infinity, labelKey: 'full', color: GREEN },
  ],
  adaptation: [
    { max: 20, labelKey: 'fragile', color: RED },
    { max: 40, labelKey: 'toImprove', color: ORANGE },
    { max: 60, labelKey: 'reduced', color: YELLOW },
    { max: 80, labelKey: 'good', color: GREEN },
    { max: Infinity, labelKey: 'excellent', color: GREEN },
  ],
}

// Segmenti dell'arco Stress, identici a _kZones di stress_gauge.dart
const STRESS_ARC_SEGMENTS = [
  { start: 0, end: 20, color: '#2E746C' }, // Equilibrio (teal dark)
  { start: 20, end: 40, color: '#2ECC71' }, // Basso
  { start: 40, end: 60, color: '#F39C12' }, // Medio
  { start: 60, end: 80, color: '#E67E22' }, // Alto
  { start: 80, end: 100, color: '#E74C3C' }, // Affaticamento
]

function zoneFor(scheme: GaugeColorScheme, v: number): Zone {
  const zones = ZONES[scheme]
  return zones.find((z) => v < z.max) ?? zones[zones.length - 1]
}

// Punto sull'arco: 0 → estremo sinistro (180°), 100 → estremo destro (360°)
function polar(cx: number, cy: number, r: number, frac: number) {
  const a = Math.PI + frac * Math.PI
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
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

  // Variazione rispetto alla precedente: colore per segno (su, giù), neutro
  // rispetto alla direzione "buona" dello score, che dipende dalla scala.
  const hasDelta = hasValue && delta != null && Number.isFinite(delta)
  const d = hasDelta ? Math.round(delta as number) : 0
  const deltaText = d === 0 ? t('deltaUnchanged') : `${d > 0 ? '▲ +' : '▼ '}${num(d, 0, locale)}`
  const deltaTone = d > 0 ? 'text-emerald-700' : d < 0 ? 'text-red-700' : 'text-anthracite-lighter'

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
            {/* Arco a segmenti colorati fissi (come GaugePainter) */}
            {STRESS_ARC_SEGMENTS.map((s) => (
              <path
                key={s.start}
                d={arcPath(cx, cy, r, s.start / 100, s.end / 100)}
                stroke={hasValue ? s.color : TRACK}
                strokeWidth={sw}
                fill="none"
              />
            ))}
            {/* Linee di separazione tra le zone */}
            {hasValue &&
              [20, 40, 60, 80].map((b) => {
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
