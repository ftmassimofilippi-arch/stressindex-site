'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { apiErrorMessage } from '@/lib/api-error'
import type { MonitoringEvent, MonitoringEventType, MonitoringNight } from '@/lib/monitoring-types'
import {
  EVENT_TYPES, MON, RESPONSE_INSUFFICIENT, dayPart, eventResponseColor, eventResponseLabel, eventTypeLabel, eventTypeLabels, hm, isSleepMarker, rmssdFromLn, wallDate,
} from '@/lib/monitoring-format'
import { indexText, monT, type Lang } from '@/lib/monitoring-strings'
import { Chip } from './MonitoringChips'
import { EventIcon } from './EventIcon'

// Eventi taggati e reazione calcolata dall'app (prima / dopo / dopo
// ritardato, delta HR e RMSSD, etichetta). Il professionista può aggiungere,
// modificare o eliminare eventi: il sito salva `events` e alza il flag
// events_modified_on_web; NON ricalcola la reazione, che resta "in attesa di
// ricalcolo" finché l'app non rielabora la sessione.
// `print`: pagina di stampa, eventi in sola lettura senza pulsanti né finestre.

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
  print?: boolean
}

export function MonitoringEvents({ sessionId, events, tz, start, end, night, readOnly: readOnlyProp = false, pendingRecalc = false, pro = true, print = false }: Props) {
  const readOnly = readOnlyProp || print
  const t = useTranslations('monitoring')
  const tc = useTranslations('common')
  const te = useTranslations('errors.api')
  const locale = useLocale() as Lang
  const router = useRouter()
  const [editing, setEditing] = useState<MonitoringEvent | 'new' | null>(null)
  const [deleting, setDeleting] = useState<MonitoringEvent | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const text = indexText('event_response', locale)
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  async function persist(next: MonitoringEvent[]) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/monitoring/${sessionId}/events?locale=${locale}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: next }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(apiErrorMessage(j, te, te('monitoring_save_failed')))
      setEditing(null)
      setDeleting(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : te('monitoring_save_failed'))
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
          <span>{t('events.pendingBanner')}</span>
        </div>
      )}
      {!readOnly && (
        <button type="button" onClick={() => setEditing('new')} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: MON.accent }}>
          <Plus size={16} /> {t('events.add')}
        </button>
      )}
      {error && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
      {sorted.length === 0 && (
        <p className="py-6 text-center text-sm text-anthracite-lighter leading-relaxed">{t('events.empty')}</p>
      )}
      {sorted.map((e) => (
        <EventCard key={e.id} event={e} tz={tz} night={night} readOnly={readOnly} print={print} pro={pro} onEdit={() => setEditing(e)} onDelete={() => setDeleting(e)} />
      ))}
      {pro && (
        <p className="text-[10.5px] text-anthracite-lighter leading-relaxed">{t('events.howComputed', { method: text.method, req: text.req })}</p>
      )}

      {!print && (
        <>
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
            title={t('events.removeTitle')}
            description={deleting ? `${deleting.label} · ${hm(deleting.timestamp, tz)}` : undefined}
            confirmText={t('events.remove')}
            cancelText={tc('cancel')}
            destructive
          />
        </>
      )}
    </div>
  )
}

function EventCard({ event, tz, night, readOnly, print = false, pro = true, onEdit, onDelete }: { event: MonitoringEvent; tz: number; night: MonitoringNight | null; readOnly: boolean; print?: boolean; pro?: boolean; onEdit: () => void; onDelete: () => void }) {
  const t = useTranslations('monitoring')
  const locale = useLocale() as Lang
  const r = event.response
  const marker = isSleepMarker(event.type)
  return (
    <div className={`card p-4 ${print ? 'print-avoid' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: MON.accentLight, color: MON.accentDark }}>
          <EventIcon type={event.type} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-anthracite text-sm">{event.label} · {hm(event.timestamp, tz)}</div>
          <div className="text-[11px] text-anthracite-lighter">{dayPart(event.timestamp, tz, night, t)}{event.note ? ` · ${event.note}` : ''}</div>
        </div>
        {r ? (
          <Chip label={eventResponseLabel(r.label, locale)} color={eventResponseColor(r.label)} size="sm" />
        ) : marker ? (
          <Chip label={t('events.nightBoundary')} color={MON.accent} size="sm" />
        ) : (
          <Chip label={t('events.pendingChip')} color={MON.warning} size="sm" icon={RefreshCw} />
        )}
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={onEdit} aria-label={t('events.edit')} className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center text-anthracite-lighter"><Pencil size={14} /></button>
            <button type="button" onClick={onDelete} aria-label={t('events.delete')} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-anthracite-lighter hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      {r && r.label !== RESPONSE_INSUFFICIENT ? (
        <div className={`mt-3 ${print ? '' : 'overflow-x-auto'}`}>
          <table className={`w-full text-[11px] ${print ? '' : 'min-w-[360px]'}`}>
            <thead>
              <tr className="text-anthracite-lighter font-bold">
                <th className="text-left py-1" /><th className="text-right py-1">{monT('ev_before', locale)}</th><th className="text-right py-1">{monT('ev_after', locale)}</th><th className="text-right py-1">{monT('ev_late', locale)}</th>
              </tr>
            </thead>
            <tbody className="text-anthracite">
              {/* Al cliente le due righe con il nome per esteso (report cliente dell'app). */}
              <tr>
                <td className="py-1 font-bold">{pro ? 'HR (bpm)' : t('simple.eventHr')}</td>
                <td className="py-1 text-right tabular-nums">{r.hr_before == null ? '—' : Math.round(r.hr_before)}</td>
                <td className="py-1 text-right tabular-nums">{r.hr_after == null ? '—' : Math.round(r.hr_after)}{delta(r.delta_hr)}</td>
                <td className="py-1 text-right tabular-nums">{r.hr_late == null ? '—' : Math.round(r.hr_late)}{delta(r.delta_hr_late)}</td>
              </tr>
              <tr>
                <td className="py-1 font-bold">{pro ? 'RMSSD (ms)' : t('simple.eventHrv')}</td>
                <td className="py-1 text-right tabular-nums">{fmtRm(r.ln_rmssd_before)}</td>
                <td className="py-1 text-right tabular-nums">{fmtRm(r.ln_rmssd_after)}{r.delta_ln_rmssd_pct == null ? '' : ` (${r.delta_ln_rmssd_pct >= 0 ? '+' : ''}${Math.round(r.delta_ln_rmssd_pct)}%)`}</td>
                <td className="py-1 text-right tabular-nums">{fmtRm(r.ln_rmssd_late)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : r ? (
        <p className="mt-2 text-[11px] text-anthracite-lighter">{t('events.insufficient')}</p>
      ) : null}
    </div>
  )
}

function delta(d: number | null): string {
  return d == null ? '' : ` (${d >= 0 ? '+' : ''}${Math.round(d)})`
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
  const t = useTranslations('monitoring')
  const tc = useTranslations('common')
  const mid = new Date((new Date(start).getTime() + new Date(end).getTime()) / 2).toISOString()
  const [type, setType] = useState<MonitoringEventType>(initial?.type ?? 'coffee')
  const [when, setWhen] = useState(toLocalInput(initial?.timestamp ?? mid, tz))
  const [label, setLabel] = useState(initial?.label ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [err, setErr] = useState<string | null>(null)

  function submit() {
    const iso = fromLocalInput(when, tz)
    if (!iso) { setErr(t('events.form.errDate')); return }
    const at = new Date(iso).getTime()
    if (at < new Date(start).getTime() || at > new Date(end).getTime()) { setErr(t('events.form.errRange')); return }
    const changed = !initial || initial.type !== type || initial.timestamp !== iso
    onSave({
      id: initial?.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `web-${Date.now()}`),
      type,
      timestamp: iso,
      label: label.trim() || eventTypeLabel(type, t),
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
      title={initial ? t('events.form.editTitle') : t('events.form.addTitle')}
      description={t('events.form.description')}
      size="sm"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2">{tc('cancel')}</button>
          <button type="button" onClick={submit} disabled={busy} className="text-sm px-5 py-2 rounded-xl text-white font-medium disabled:opacity-50 inline-flex items-center gap-2" style={{ backgroundColor: MON.accent }}>
            {busy && <Loader2 size={14} className="animate-spin" />} {tc('save')}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="input-label">{t('events.form.type')}</label>
          <select className="select-field w-full" value={type} onChange={(e) => { const next = e.target.value as MonitoringEventType; setType(next); if (!label || eventTypeLabels(t).includes(label)) setLabel(eventTypeLabel(next, t)) }}>
            {EVENT_TYPES.map((k) => <option key={k} value={k}>{eventTypeLabel(k, t)}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">{t('events.form.dateTime')}</label>
          <input type="datetime-local" className="input-field" value={when} min={toLocalInput(start, tz)} max={toLocalInput(end, tz)} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div>
          <label className="input-label">{t('events.form.label')}</label>
          <input className="input-field" value={label} placeholder={eventTypeLabel(type, t)} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="input-label">{t('events.form.note')}</label>
          <input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {err && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
      </div>
    </Modal>
  )
}
