'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import type { MonitoringEvent, MonitoringEventType, MonitoringNight } from '@/lib/monitoring-types'
import { EVENT_TYPES, EVENT_TYPE_LABEL, MON, dayPart, eventResponseColor, hm, isSleepMarker, rmssdFromLn, wallDate } from '@/lib/monitoring-format'
import { indexText } from '@/lib/monitoring-strings'
import { Chip } from './MonitoringChips'
import { EventIcon } from './EventIcon'

// Eventi taggati e reazione calcolata dall'app (prima / dopo / dopo
// ritardato, delta HR e RMSSD, etichetta). Il professionista può aggiungere,
// modificare o eliminare eventi: il sito salva `events` e alza il flag
// events_modified_on_web; NON ricalcola la reazione, che resta "in attesa di
// ricalcolo" finché l'app non rielabora la sessione.

type Props = {
  sessionId: string
  events: MonitoringEvent[]
  tz: number
  start: string
  end: string
  night: MonitoringNight | null
  readOnly?: boolean
  pendingRecalc?: boolean
  pro?: boolean
}

export function MonitoringEvents({ sessionId, events, tz, start, end, night, readOnly = false, pendingRecalc = false, pro = true }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<MonitoringEvent | 'new' | null>(null)
  const [deleting, setDeleting] = useState<MonitoringEvent | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const text = indexText('event_response')
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  async function persist(next: MonitoringEvent[]) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/monitoring/${sessionId}/events`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: next }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error ?? 'Salvataggio non riuscito')
      setEditing(null)
      setDeleting(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-[13px] font-extrabold text-anthracite">{text.name}</div>
      <p className="text-[12px] text-anthracite leading-relaxed">{text.phrase}</p>
      {pendingRecalc && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-[12px] text-amber-800">
          <RefreshCw size={15} className="mt-0.5 flex-shrink-0" />
          <span>Eventi modificati dal sito: la reazione agli eventi verrà ricalcolata dall&apos;app alla prossima apertura di questo monitoraggio. Fino ad allora i nuovi eventi sono &quot;in attesa di ricalcolo&quot;.</span>
        </div>
      )}
      {!readOnly && (
        <button type="button" onClick={() => setEditing('new')} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: MON.accent }}>
          <Plus size={16} /> Aggiungi evento
        </button>
      )}
      {error && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
      {sorted.length === 0 && (
        <p className="py-6 text-center text-sm text-anthracite-lighter leading-relaxed">
          Nessun evento. Aggiungi caffè, pasti, allenamento, sonno: per ognuno vedrai la risposta dell&apos;organismo nell&apos;ora successiva e nelle due ore dopo.
        </p>
      )}
      {sorted.map((e) => (
        <EventCard key={e.id} event={e} tz={tz} night={night} readOnly={readOnly} onEdit={() => setEditing(e)} onDelete={() => setDeleting(e)} />
      ))}
      {pro && (
        <p className="text-[10.5px] text-anthracite-lighter leading-relaxed">Come si calcola: {text.method} Requisito: {text.req}</p>
      )}

      {editing && (
        <EventForm
          initial={editing === 'new' ? null : editing}
          tz={tz}
          start={start}
          end={end}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(ev) => {
            const next = editing === 'new' ? [...events, ev] : events.map((x) => (x.id === ev.id ? ev : x))
            void persist(next)
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) return persist(events.filter((x) => x.id !== deleting.id)) }}
        title="Rimuovere l'evento?"
        description={deleting ? `${deleting.label} · ${hm(deleting.timestamp, tz)}` : undefined}
        confirmText="Rimuovi"
        destructive
      />
    </div>
  )
}

function EventCard({ event, tz, night, readOnly, onEdit, onDelete }: { event: MonitoringEvent; tz: number; night: MonitoringNight | null; readOnly: boolean; onEdit: () => void; onDelete: () => void }) {
  const r = event.response
  const marker = isSleepMarker(event.type)
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: MON.accentLight, color: MON.accentDark }}>
          <EventIcon type={event.type} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-anthracite text-sm">{event.label} · {hm(event.timestamp, tz)}</div>
          <div className="text-[11px] text-anthracite-lighter">{dayPart(event.timestamp, tz, night)}{event.note ? ` · ${event.note}` : ''}</div>
        </div>
        {r ? (
          <Chip label={r.label} color={eventResponseColor(r.label)} size="sm" />
        ) : marker ? (
          <Chip label="confine notte" color={MON.accent} size="sm" />
        ) : (
          <Chip label="in attesa di ricalcolo" color={MON.warning} size="sm" icon={RefreshCw} />
        )}
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={onEdit} aria-label="Modifica evento" className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center text-anthracite-lighter"><Pencil size={14} /></button>
            <button type="button" onClick={onDelete} aria-label="Elimina evento" className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-anthracite-lighter hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      {r && r.label !== 'dati insufficienti' ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[11px] min-w-[360px]">
            <thead>
              <tr className="text-anthracite-lighter font-bold">
                <th className="text-left py-1" /><th className="text-right py-1">Prima</th><th className="text-right py-1">Dopo</th><th className="text-right py-1">Dopo 1-3h</th>
              </tr>
            </thead>
            <tbody className="text-anthracite">
              <tr>
                <td className="py-1 font-bold">HR (bpm)</td>
                <td className="py-1 text-right tabular-nums">{r.hr_before == null ? '—' : Math.round(r.hr_before)}</td>
                <td className="py-1 text-right tabular-nums">{r.hr_after == null ? '—' : Math.round(r.hr_after)}{delta(r.delta_hr, 0)}</td>
                <td className="py-1 text-right tabular-nums">{r.hr_late == null ? '—' : Math.round(r.hr_late)}{delta(r.delta_hr_late, 0)}</td>
              </tr>
              <tr>
                <td className="py-1 font-bold">RMSSD (ms)</td>
                <td className="py-1 text-right tabular-nums">{fmtRm(r.ln_rmssd_before)}</td>
                <td className="py-1 text-right tabular-nums">{fmtRm(r.ln_rmssd_after)}{r.delta_ln_rmssd_pct == null ? '' : ` (${r.delta_ln_rmssd_pct >= 0 ? '+' : ''}${Math.round(r.delta_ln_rmssd_pct)}%)`}</td>
                <td className="py-1 text-right tabular-nums">{fmtRm(r.ln_rmssd_late)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : r ? (
        <p className="mt-2 text-[11px] text-anthracite-lighter">Dati insufficienti: l&apos;evento cade in attività, vicino a un buco o alla fine della registrazione.</p>
      ) : null}
    </div>
  )
}

function delta(d: number | null, dec: number): string {
  return d == null ? '' : ` (${d >= 0 ? '+' : ''}${d.toFixed(dec)})`
}
function fmtRm(ln: number | null): string {
  const v = rmssdFromLn(ln)
  return v == null ? '—' : `${Math.round(v)}`
}

// ── Form aggiungi / modifica ─────────────────────────────────────────────────

function toLocalInput(iso: string, tz: number): string {
  const d = wallDate(iso, tz)
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}
function fromLocalInput(v: string, tz: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  if (!m) return null
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  return new Date(wall - tz * 60_000).toISOString()
}

function EventForm({ initial, tz, start, end, busy, onClose, onSave }: { initial: MonitoringEvent | null; tz: number; start: string; end: string; busy: boolean; onClose: () => void; onSave: (e: MonitoringEvent) => void }) {
  const mid = new Date((new Date(start).getTime() + new Date(end).getTime()) / 2).toISOString()
  const [type, setType] = useState<MonitoringEventType>(initial?.type ?? 'coffee')
  const [when, setWhen] = useState(toLocalInput(initial?.timestamp ?? mid, tz))
  const [label, setLabel] = useState(initial?.label ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [err, setErr] = useState<string | null>(null)

  function submit() {
    const iso = fromLocalInput(when, tz)
    if (!iso) { setErr('Indica data e ora'); return }
    const t = new Date(iso).getTime()
    if (t < new Date(start).getTime() || t > new Date(end).getTime()) { setErr('L\'evento deve cadere dentro il periodo della registrazione'); return }
    const changed = !initial || initial.type !== type || initial.timestamp !== iso
    onSave({
      id: initial?.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `web-${Date.now()}`),
      type,
      timestamp: iso,
      label: label.trim() || EVENT_TYPE_LABEL[type],
      note: note.trim() || null,
      // La reazione non si calcola sul sito: un evento nuovo o spostato la perde
      // finché l'app non rielabora.
      response: changed ? null : initial?.response ?? null,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Modifica evento' : 'Aggiungi evento'}
      description="Inserimento a posteriori · la reazione verrà calcolata dall'app"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2">Annulla</button>
          <button type="button" onClick={submit} disabled={busy} className="text-sm px-5 py-2 rounded-xl text-white font-medium disabled:opacity-50 inline-flex items-center gap-2" style={{ backgroundColor: MON.accent }}>
            {busy && <Loader2 size={14} className="animate-spin" />} Salva
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="input-label">Tipo</label>
          <select className="select-field w-full" value={type} onChange={(e) => { const t = e.target.value as MonitoringEventType; setType(t); if (!label || Object.values(EVENT_TYPE_LABEL).includes(label)) setLabel(EVENT_TYPE_LABEL[t]) }}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Data e ora (orologio del dispositivo)</label>
          <input type="datetime-local" className="input-field" value={when} min={toLocalInput(start, tz)} max={toLocalInput(end, tz)} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Etichetta</label>
          <input className="input-field" value={label} placeholder={EVENT_TYPE_LABEL[type]} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Nota (opzionale)</label>
          <input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {err && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
      </div>
    </Modal>
  )
}
