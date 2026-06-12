'use client'

// Tachimetro semicircolare identico a quello dell'app Flutter:
//  - Stress  → arco a 5 segmenti colorati fissi (verde→rosso) + ago
//              (replica GaugePainter di stress_gauge.dart)
//  - Altri   → arco grigio di sfondo + riempimento proporzionale al valore
//              nel colore della zona + ago
//              (replica _MiniGaugePainter di proprietary_score_card.dart)
//  Sotto l'arco: numero grande, "/ 100", badge della zona
//  (soglie e label da proprietary_scores.dart).

export type GaugeColorScheme = 'stress' | 'recovery' | 'balance' | 'energy' | 'inflammation'

type Props = {
  value?: number | null // 0–100
  label: string // "STRESS", "RECUPERO", ...
  colorScheme: GaugeColorScheme
}

// Palette allineata ad AppColors dell'app
const GREEN = '#2F8F6B' // AppColors.success
const YELLOW = '#C78A2C' // AppColors.warning
const ORANGE = '#E67E22'
const RED = '#C44E4E' // AppColors.error
const DARK_RED = '#A93226'
const TRACK = '#E2E6EA' // AppColors.borderLight

type Zone = { max: number; label: string; color: string }

// Soglie identiche a proprietary_scores.dart (_stressZone, _recoveryZone, ...)
const ZONES: Record<GaugeColorScheme, Zone[]> = {
  stress: [
    { max: 30, label: 'Basso', color: GREEN },
    { max: 50, label: 'Equilibrio', color: YELLOW },
    { max: 70, label: 'Medio', color: ORANGE },
    { max: 85, label: 'Alto', color: RED },
    { max: Infinity, label: 'Esaurimento', color: DARK_RED },
  ],
  recovery: [
    { max: 25, label: 'Insufficiente', color: RED },
    { max: 45, label: 'Scarso', color: ORANGE },
    { max: 65, label: 'Moderato', color: YELLOW },
    { max: 85, label: 'Buono', color: GREEN },
    { max: Infinity, label: 'Ottimale', color: GREEN },
  ],
  balance: [
    { max: 25, label: 'Squilibrio marcato', color: RED },
    { max: 45, label: 'Squilibrio moderato', color: ORANGE },
    { max: 65, label: 'Sufficiente', color: YELLOW },
    { max: 85, label: 'Buono', color: GREEN },
    { max: Infinity, label: 'Ottimale', color: GREEN },
  ],
  energy: [
    { max: 25, label: 'Esaurita', color: RED },
    { max: 45, label: 'Bassa', color: ORANGE },
    { max: 65, label: 'Moderata', color: YELLOW },
    { max: 85, label: 'Buona', color: GREEN },
    { max: Infinity, label: 'Piena', color: GREEN },
  ],
  inflammation: [
    { max: 20, label: 'Fragile', color: RED },
    { max: 40, label: 'Compromessa', color: ORANGE },
    { max: 60, label: 'Ridotta', color: YELLOW },
    { max: 80, label: 'Buona', color: GREEN },
    { max: Infinity, label: 'Eccellente', color: GREEN },
  ],
}

// Segmenti dell'arco Stress, identici a _kZones di stress_gauge.dart
const STRESS_ARC_SEGMENTS = [
  { start: 0, end: 20, color: '#2E746C' }, // Equilibrio (teal dark)
  { start: 20, end: 40, color: '#2ECC71' }, // Basso
  { start: 40, end: 60, color: '#F39C12' }, // Medio
  { start: 60, end: 80, color: '#E67E22' }, // Alto
  { start: 80, end: 100, color: '#E74C3C' }, // Esaurimento
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

export function GaugeScore({ value, label, colorScheme }: Props) {
  const hasValue = value != null && Number.isFinite(value)
  const v = hasValue ? Math.max(0, Math.min(100, value as number)) : 0
  const zone = zoneFor(colorScheme, v)

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
    <div className="card p-5 flex flex-col items-center">
      <div className="text-xs font-medium text-anthracite-lighter uppercase tracking-wide">{label}</div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="mt-2 max-w-[200px]" role="img" aria-label={`${label}: ${hasValue ? Math.round(v) : '—'} su 100`}>
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
                style={{ transition: 'all 0.5s ease' }}
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
        className="mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
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
        {hasValue ? zone.label : 'Nessun dato'}
      </div>
    </div>
  )
}
