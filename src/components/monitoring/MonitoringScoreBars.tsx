import { ScoreBar } from '@/components/dashboard/ScoreBar'
import type { MonitoringScores } from '@/lib/monitoring-types'
import { MON } from '@/lib/monitoring-format'
import { scoreT } from '@/lib/monitoring-strings'

// I cinque score proprietari (0-100) più il composito, con il widget a barre
// orizzontali già usato nel sito (ScoreBar) e i nomi dell'app.
export function MonitoringScoreBars({ scores, title }: { scores: MonitoringScores; title?: string }) {
  const rows: Array<{ label: string; value: number; inverted?: boolean }> = [
    { label: scoreT('stress_score'), value: scores.stress, inverted: true },
    { label: scoreT('recovery_score'), value: scores.recovery },
    { label: scoreT('balance_score'), value: scores.balance },
    { label: scoreT('energy_score'), value: scores.energy },
    { label: scoreT('inflammatory_score'), value: scores.inflammation },
  ]
  return (
    <div>
      {title && <div className="text-[13px] font-bold text-anthracite mb-2">{title}</div>}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-anthracite">Score composito</span>
        <span className="text-lg font-extrabold" style={{ color: MON.accentDark }}>{Math.round(scores.composite)}</span>
      </div>
      <div className="space-y-2 border-t border-surface-border pt-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-28 text-xs text-anthracite-lighter">{r.label}</span>
            <div className="flex-1"><ScoreBar value={r.value} inverted={r.inverted} /></div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-anthracite-lighter">
        {scores.demo_normalized ? 'Score normalizzati sul profilo demografico.' : 'Score su norme di popolazione generale (profilo incompleto).'}
      </p>
    </div>
  )
}
