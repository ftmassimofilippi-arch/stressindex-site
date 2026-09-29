'use client'

import { ZoomIn, ZoomOut } from 'lucide-react'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('charts.scale')
  const Icon = zoom ? ZoomOut : ZoomIn
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-[11px]">
      {extended && !zoom && <span className="text-anthracite-lighter">{t('extendedNote')}</span>}
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border whitespace-nowrap transition-colors ${
          zoom
            ? 'border-teal text-teal-dark bg-teal-light/60'
            : 'border-surface-border text-anthracite-lighter hover:text-anthracite'
        }`}
        title={zoom ? t('fixedTitle') : t('zoomTitle')}
      >
        <Icon size={12} />
        {zoom ? t('fixed') : t('zoom')}
      </button>
    </div>
  )
}
