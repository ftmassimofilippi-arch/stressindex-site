'use client'

import { ZoomIn, ZoomOut } from 'lucide-react'
import { EXTENDED_SCALE_NOTE } from '@/lib/chart-scales'

// Comando "Zoom" nell'intestazione di un grafico, con la nota della scala.
// Il grafico parte sempre in scala fissa (confrontabile fra misurazioni e con
// l'app); il pulsante passa alla scala adattiva per guardare da vicino la
// singola misurazione, e lo dichiara.
export function ScaleToggle({
  zoom,
  onToggle,
  extended = false,
}: {
  zoom: boolean
  onToggle: () => void
  extended?: boolean
}) {
  const Icon = zoom ? ZoomOut : ZoomIn
  return (
    <div className="flex items-center justify-end gap-2 text-[11px]">
      {extended && !zoom && <span className="text-anthracite-lighter">{EXTENDED_SCALE_NOTE}</span>}
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${
          zoom
            ? 'border-teal text-teal-dark bg-teal-light/60'
            : 'border-surface-border text-anthracite-lighter hover:text-anthracite'
        }`}
        title={zoom ? 'Torna alla scala fissa, confrontabile fra misurazioni' : 'Scala adattiva ai dati di questa misurazione'}
      >
        <Icon size={12} />
        {zoom ? 'Scala fissa' : 'Zoom'}
      </button>
    </div>
  )
}
