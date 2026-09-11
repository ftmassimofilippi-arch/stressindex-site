'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle, MinusCircle, type LucideIcon } from 'lucide-react'
import type { IndexText } from '@/lib/monitoring-strings'
import { LEVEL_COLOR, MON, type IndexLevel } from '@/lib/monitoring-format'
import { LevelChip } from './MonitoringChips'

// Card di un indice a due livelli (MonitoringIndexCard dell'app).
// Livello 1: nome semplice, valore con unità, etichetta a tre livelli con
// colore, riga di dettaglio, frase "cosa mi sta dicendo" (testo ESATTO
// dell'app). Livello 2, dietro l'icona "Come si calcola" (solo
// professionista): nome tecnico, metodo, requisito minimo, referenza.
// Se l'indice non è calcolabile la card diventa una riga con il motivo
// scritto dall'app, mai un trattino muto.

type Props = {
  text: IndexText
  value?: string | null
  unit?: string | null
  level?: IndexLevel | null
  detail?: string | null
  unavailableReason?: string | null
  unreliable?: boolean
  pro?: boolean
  icon?: LucideIcon
  children?: React.ReactNode
  /** Sfondo neutro per le card nel report cliente (senza "Come si calcola"). */
  className?: string
}

export function MonitoringIndexCard({ text, value, unit, level, detail, unavailableReason, unreliable, pro = true, icon: Icon, children, className = '' }: Props) {
  if (unavailableReason) {
    return (
      <div className={`rounded-xl px-3.5 py-2.5 flex items-start gap-2 text-[12px] ${className}`} style={{ backgroundColor: MON.secondarySurface, color: MON.textSecondary }}>
        {Icon ? <Icon size={16} className="mt-0.5 flex-shrink-0" style={{ color: MON.textMuted }} /> : <MinusCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: MON.textMuted }} />}
        <div><span className="font-bold text-anthracite">{text.name}: </span>{unavailableReason}</div>
      </div>
    )
  }
  const color = level ? LEVEL_COLOR[level] : MON.accentDark
  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: MON.accentLight, color: MON.accentDark }}>
            <Icon size={19} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-extrabold text-anthracite flex-1">{text.name}</div>
            {unreliable && (
              <span title="Copertura sotto il 60%: valore da leggere con cautela" className="text-amber-600"><AlertTriangle size={15} /></span>
            )}
            {pro && <HowPopover text={text} />}
          </div>
          {value != null && (
            <div className="mt-0.5 flex flex-wrap items-end gap-x-1.5 gap-y-1">
              <span className="text-[22px] leading-none font-extrabold" style={{ color }}>{value}</span>
              {unit && <span className="text-[11px] text-anthracite-lighter pb-0.5">{unit}</span>}
              {level && <span className="pb-0.5"><LevelChip level={level} size="sm" /></span>}
            </div>
          )}
          {detail && <div className="mt-1 text-[11px] text-anthracite-lighter whitespace-pre-line">{detail}</div>}
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-anthracite">{text.phrase}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

/** Icona "Come si calcola" con popover: nome tecnico, metodo, requisito, referenza. */
export function HowPopover({ text }: { text: IndexText }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Come si calcola"
        title="Come si calcola"
        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface transition-colors"
        style={{ color: MON.accent }}
      >
        <HelpCircle size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-[min(92vw,380px)] rounded-xl border border-surface-border bg-white shadow-elevated p-3.5 text-[11px] leading-relaxed text-anthracite-lighter">
          <div className="text-[11px] font-bold mb-2" style={{ color: MON.accent }}>Come si calcola</div>
          <Kv k="Nome tecnico" v={text.tech} />
          <Kv k="Metodo" v={text.method} />
          <Kv k="Requisito minimo" v={text.req} />
          <Kv k="Referenza" v={text.ref} />
        </div>
      )}
    </div>
  )
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="mb-1.5"><span className="font-bold text-anthracite">{k}: </span>{v}</div>
  )
}
