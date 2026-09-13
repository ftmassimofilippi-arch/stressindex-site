'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Activity, Bike, Moon, Puzzle, type LucideIcon } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import type { AccountCommerciale, AccountModulo, AccountStato, ModuloCatalogo, PianoCatalogo } from '@/lib/admin-commerciale'
import { formatDate } from '@/lib/format'
import { api, type Toast } from './adminApi'

// ============================================================================
// Pezzi comuni della gestione commerciale nel pannello Super Admin (stile
// Notion: testo piccolo, pallini, pill leggere, bordi sottili). Nessuna logica
// di accesso qui: attivo/fonte arrivano da modulo_accesso_dettaglio (DB).
// ============================================================================

export type Catalogo = { moduli: ModuloCatalogo[]; piani: PianoCatalogo[] }

export const STATO_LABEL: Record<AccountStato, string> = {
  attivo: 'Attivo',
  prova: 'In prova',
  sospeso: 'Sospeso',
  bloccato: 'Bloccato',
}

const STATO_DOT: Record<AccountStato, string> = {
  attivo: 'bg-emerald-500',
  prova: 'bg-sky-500',
  sospeso: 'bg-amber-500',
  bloccato: 'bg-red-500',
}

export function StatoDot({ stato, withLabel = true }: { stato: AccountStato; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-anthracite whitespace-nowrap">
      <span className={`w-2 h-2 rounded-full ${STATO_DOT[stato]}`} aria-hidden />
      {withLabel && STATO_LABEL[stato]}
    </span>
  )
}

export function pianoNome(catalogo: Catalogo | null, codice: string | null): string {
  if (!codice) return '—'
  return catalogo?.piani.find((p) => p.codice === codice)?.nome ?? codice
}

export function PianoPill({ piano, catalogo }: { piano: string | null; catalogo: Catalogo | null }) {
  if (!piano) return <span className="text-anthracite-lighter text-[13px]">—</span>
  const cls =
    piano === 'pro'
      ? 'bg-teal-50 text-teal-dark border-teal-200'
      : piano === 'prova'
        ? 'bg-sky-50 text-sky-700 border-sky-200'
        : 'bg-surface text-anthracite-light border-surface-border'
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[12px] ${cls}`}>{pianoNome(catalogo, piano)}</span>
}

// Soglie di avviso: 30, 7 e 1 giorno.
export function scadenzaLivello(giorni: number | null): 'scaduto' | '1' | '7' | '30' | null {
  if (giorni === null) return null
  if (giorni < 0) return 'scaduto'
  if (giorni <= 1) return '1'
  if (giorni <= 7) return '7'
  if (giorni <= 30) return '30'
  return null
}

export function ScadenzaCell({ c }: { c: AccountCommerciale | null }) {
  if (!c?.data_scadenza) return <span className="text-anthracite-lighter text-[13px]">{c?.piano ? 'Nessuna' : '—'}</span>
  const lvl = scadenzaLivello(c.giorni_alla_scadenza)
  const g = c.giorni_alla_scadenza ?? 0
  const badge =
    lvl === 'scaduto'
      ? { cls: 'bg-red-50 text-red-600', text: 'Scaduto' }
      : lvl === '1'
        ? { cls: 'bg-red-50 text-red-600', text: g <= 0 ? 'Oggi' : 'Domani' }
        : lvl === '7'
          ? { cls: 'bg-amber-50 text-amber-700', text: `${g} gg` }
          : lvl === '30'
            ? { cls: 'bg-yellow-50 text-yellow-700', text: `${g} gg` }
            : null
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-anthracite">
      {formatDate(c.data_scadenza, 'dd/MM/yy')}
      {badge && <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${badge.cls}`}>{badge.text}</span>}
      {c.rinnovo_automatico && <span className="text-[11px] text-anthracite-lighter" title="Rinnovo automatico">↻</span>}
    </span>
  )
}

const MODULE_ICONS: Record<string, LucideIcon> = { bike: Bike, activity: Activity, moon: Moon }

export function moduleIcon(catalogo: Catalogo | null, codice: string): LucideIcon {
  const icona = catalogo?.moduli.find((m) => m.codice === codice)?.icona ?? ''
  return MODULE_ICONS[icona] ?? Puzzle
}

export function fonteLabel(m: AccountModulo, piano: string | null, catalogo: Catalogo | null): string {
  switch (m.fonte) {
    case 'superadmin': return 'Superadmin'
    case 'stato': return 'Bloccato dallo stato dell’account'
    case 'modulo_disattivato': return 'Modulo disattivato nel catalogo'
    case 'eccezione':
      return `${m.eccezione_abilitata ? 'Attivato' : 'Disattivato'} per eccezione${m.eccezione_scade_il ? ` fino al ${formatDate(m.eccezione_scade_il, 'dd/MM/yyyy')}` : ''}`
    case 'piano': return `Incluso nel piano ${pianoNome(catalogo, piano)}`
    case 'scaduto': return 'Incluso nel piano, ma abbonamento scaduto'
    case 'professionista': return m.attivo ? 'Coperto da un professionista collegato' : 'Nessun professionista collegato con il modulo'
    default: return `Non incluso nel piano ${pianoNome(catalogo, piano)}`
  }
}

// Icone dei moduli attivi: piene se ereditati dal piano, bordo tratteggiato se
// per eccezione. I moduli tolti per eccezione compaiono barrati.
export function ModuleIcons({ c, catalogo }: { c: AccountCommerciale | null; catalogo: Catalogo | null }) {
  if (!c) return <span className="text-anthracite-lighter text-[13px]">—</span>
  const shown = c.moduli.filter((m) => m.attivo || (m.fonte === 'eccezione' && m.eccezione_abilitata === false))
  if (shown.length === 0) return <span className="text-anthracite-lighter text-[13px]">—</span>
  return (
    <span className="inline-flex items-center gap-1">
      {shown.map((m) => {
        const Icon = moduleIcon(catalogo, m.codice)
        const nome = catalogo?.moduli.find((x) => x.codice === m.codice)?.nome ?? m.codice
        const exc = m.fonte === 'eccezione'
        const cls = !m.attivo
          ? 'text-anthracite-lighter/60 border border-dashed border-surface-border line-through'
          : exc
            ? 'text-amber-700 border border-dashed border-amber-400 bg-amber-50/60'
            : 'text-teal-dark bg-teal-50 border border-transparent'
        return (
          <span key={m.codice} title={`${nome}: ${fonteLabel(m, c.piano, catalogo)}`} className={`w-6 h-6 rounded-md inline-flex items-center justify-center relative ${cls}`}>
            <Icon size={13} />
            {!m.attivo && <span className="absolute w-4 h-px bg-anthracite-lighter rotate-45" aria-hidden />}
          </span>
        )
      })}
    </span>
  )
}

// ── Azioni ──────────────────────────────────────────────────────────────────

export async function accountAction(
  userId: string,
  body: Record<string, unknown>,
  showToast: (t: Toast) => void,
  okText: string,
): Promise<boolean> {
  const { ok, json } = await api('POST', `/api/admin/users/${userId}/account`, body)
  if (!ok) {
    showToast({ kind: 'err', text: json?.message ?? json?.error ?? 'Operazione non riuscita' })
    return false
  }
  showToast({ kind: json?.warning ? 'err' : 'ok', text: json?.warning ?? okText })
  return true
}

// Finestra con motivo obbligatorio (e scadenza facoltativa per le eccezioni).
export function ReasonDialog({
  title,
  description,
  confirmText,
  destructive,
  withDate,
  dateLabel = 'Scadenza (facoltativa)',
  onCancel,
  onConfirm,
}: {
  title: string
  description?: string
  confirmText: string
  destructive?: boolean
  withDate?: boolean
  dateLabel?: string
  onCancel: () => void
  onConfirm: (motivo: string, data: string | null) => Promise<void> | void
}) {
  const [motivo, setMotivo] = useState('')
  const [data, setData] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary text-sm">Annulla</button>
          <button
            type="button"
            disabled={!motivo.trim() || busy}
            onClick={async () => {
              setBusy(true)
              try { await onConfirm(motivo.trim(), data || null) } finally { setBusy(false) }
            }}
            className={`text-sm px-5 py-2.5 rounded-xl font-medium text-white disabled:opacity-50 ${destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-teal hover:bg-teal-dark'}`}
          >
            {busy ? 'Attendere…' : confirmText}
          </button>
        </div>
      }
    >
      <label className="input-label">Motivo (visibile solo al superadmin)</label>
      <input autoFocus className="input-field" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      {withDate && (
        <div className="mt-3">
          <label className="input-label">{dateLabel}</label>
          <input type="date" className="input-field" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      )}
    </Modal>
  )
}

// Menu a tendina posizionato in fixed (le tabelle hanno overflow-x: auto).
export function RowMenu({ anchor, onClose, children }: { anchor: HTMLElement; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const width = 240
    const height = ref.current?.offsetHeight ?? 280
    const top = r.bottom + 4 + height > window.innerHeight ? Math.max(8, r.top - height - 4) : r.bottom + 4
    setPos({ top, left: Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width)) })
  }, [anchor])
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onScroll() { onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [anchor, onClose])
  return (
    <div
      ref={ref}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className="fixed z-[55] w-60 bg-white border border-surface-border rounded-xl shadow-elevated py-1.5 text-[13px]"
    >
      {children}
    </div>
  )
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-anthracite-lighter">{children}</div>
}

export function MenuItem({ icon: Icon, children, onClick, danger, disabled, hint }: { icon?: LucideIcon; children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean; hint?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent ${danger ? 'text-red-600' : 'text-anthracite'}`}
    >
      {Icon && <Icon size={14} className={danger ? 'text-red-500' : 'text-anthracite-lighter'} />}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[11px] text-anthracite-lighter">{hint}</span>}
    </button>
  )
}
