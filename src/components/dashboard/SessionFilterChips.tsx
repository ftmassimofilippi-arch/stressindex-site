'use client'

// Due righe di chip con i conteggi: etichette e tipo di test. I due filtri si
// combinano in AND; un chip compare solo se ha almeno una misurazione (quello
// selezionato resta visibile per poterlo togliere). Stessa logica dell'app
// (SessionFilterBar).

export interface ChipOption {
  value: string
  label: string
  count: number
  color?: string
}

export function FilterChipRow({
  allLabel,
  total,
  options,
  selected,
  onChange,
}: {
  allLabel: string
  total: number
  options: ChipOption[]
  selected: string | null
  onChange: (v: string | null) => void
}) {
  const visible = options.filter((o) => o.count > 0 || o.value === selected)
  if (visible.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip label={allLabel} count={total} selected={selected == null} onClick={() => onChange(null)} />
      {visible.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          count={o.count}
          color={o.color}
          selected={selected === o.value}
          onClick={() => onChange(selected === o.value ? null : o.value)}
        />
      ))}
    </div>
  )
}

function Chip({
  label,
  count,
  color,
  selected,
  onClick,
}: {
  label: string
  count: number
  color?: string
  selected: boolean
  onClick: () => void
}) {
  const c = color ?? '#4FA39A'
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
      style={
        selected
          ? { backgroundColor: c, borderColor: c, color: '#fff' }
          : { backgroundColor: `${c}1A`, borderColor: `${c}59`, color: c }
      }
    >
      {label}
      <span className={selected ? 'opacity-90' : 'opacity-80'}>({count})</span>
    </button>
  )
}
