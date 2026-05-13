'use client'

import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, BarChart, Bar, Cell } from 'recharts'
import { num } from '@/lib/format'

export function PoincareScatter({ rr, sd1, sd2 }: { rr: number[] | null; sd1: number | null; sd2: number | null }) {
  if (!rr || rr.length < 2) {
    return <Placeholder text="Dati RR non disponibili" />
  }
  const points = rr.slice(0, -1).map((v, i) => ({ x: v, y: rr[i + 1] }))
  // limita a 1000 punti per perf
  const sample = points.length > 1000 ? points.filter((_, i) => i % Math.ceil(points.length / 1000) === 0) : points

  const allVals = sample.flatMap((p) => [p.x, p.y])
  const min = Math.min(...allVals)
  const max = Math.max(...allVals)

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
          <CartesianGrid stroke="#E2E6EA" />
          <XAxis type="number" dataKey="x" domain={[min, max]} stroke="#6B7280" fontSize={10} tickFormatter={(v) => v.toFixed(0)} label={{ value: 'RR(n) ms', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#6B7280' }} />
          <YAxis type="number" dataKey="y" domain={[min, max]} stroke="#6B7280" fontSize={10} tickFormatter={(v) => v.toFixed(0)} label={{ value: 'RR(n+1) ms', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#6B7280' }} />
          <ZAxis range={[10, 10]} />
          <Tooltip contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }} />
          <Scatter data={sample} fill="#4FA39A" fillOpacity={0.5} />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-around mt-2 text-xs text-anthracite-lighter">
        <div>SD1: <b className="text-anthracite">{num(sd1)}</b> ms</div>
        <div>SD2: <b className="text-anthracite">{num(sd2)}</b> ms</div>
      </div>
    </div>
  )
}

export function Rhythmogram({ rr }: { rr: number[] | null }) {
  if (!rr || rr.length === 0) {
    return <Placeholder text="Dati RR non disponibili" />
  }
  let acc = 0
  const data = rr.map((v) => {
    acc += v
    return { t: acc / 1000, rr: v }
  })
  const sample = data.length > 1200 ? data.filter((_, i) => i % Math.ceil(data.length / 1200) === 0) : data

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={sample} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" />
        <XAxis dataKey="t" stroke="#6B7280" fontSize={10} tickFormatter={(v) => `${Math.round(v)}s`} />
        <YAxis stroke="#6B7280" fontSize={10} tickFormatter={(v) => `${v}`} domain={['auto', 'auto']} />
        <Tooltip contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }} />
        <Line type="monotone" dataKey="rr" stroke="#4FA39A" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function PsdPlaceholder({ vlf, lf, hf }: { vlf: number | null; lf: number | null; hf: number | null }) {
  const data = [
    { band: 'VLF', value: vlf ?? 0, color: '#94A3B8' },
    { band: 'LF', value: lf ?? 0, color: '#F59E0B' },
    { band: 'HF', value: hf ?? 0, color: '#10B981' },
  ]
  if (vlf == null && lf == null && hf == null) return <Placeholder text="Dati spettro non disponibili" />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EA" vertical={false} />
        <XAxis dataKey="band" stroke="#6B7280" fontSize={11} />
        <YAxis stroke="#6B7280" fontSize={10} tickFormatter={(v) => v.toFixed(0)} />
        <Tooltip contentStyle={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E6EA', fontSize: 11 }} formatter={(v) => [`${Number(v).toFixed(1)} ms²`, 'Potenza']} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((d) => <Cell key={d.band} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function Placeholder({ text }: { text: string }) {
  return <div className="h-[220px] flex items-center justify-center text-sm text-anthracite-lighter bg-surface rounded-xl">{text}</div>
}
