'use client'

import { useState } from 'react'
import { AlertCircle, Download, FileText, Loader2, Mail, Table, X } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import type { MonitoringSession } from '@/lib/monitoring-types'
import { isSleepSession } from '@/lib/monitoring-types'
import { MON, dayNumeric } from '@/lib/monitoring-format'

// Azioni del dettaglio (3.10): PDF professionista, PDF cliente, export RR
// grezzi (dal bucket), export finestre, invio al cliente. Tutte le route
// stanno in /api/monitoring/[id]/*.

const GENERIC_ERROR = 'Operazione non riuscita. Controlla la connessione e riprova.'

async function download(url: string, fallbackName: string) {
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    let message = GENERIC_ERROR
    try { const j = await res.json(); if (typeof j?.error === 'string') message = j.error } catch { /* non JSON */ }
    throw new Error(message)
  }
  const blob = await res.blob()
  let filename = fallbackName
  const cd = res.headers.get('Content-Disposition')
  const m = cd?.match(/filename="?([^"]+)"?/i)
  if (m?.[1]) filename = m[1]
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

export function MonitoringActions({ session, readOnly = false }: { session: MonitoringSession; readOnly?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const sleep = isSleepSession(session)
  const base = `/api/monitoring/${session.id}`
  const accent = sleep ? MON.sleep : MON.accent
  const date = dayNumeric(session.start_time, session.tz_offset_minutes).replace(/\//g, '-')

  async function run(key: string, fn: () => Promise<void>) {
    if (busy) return
    setBusy(key)
    setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : GENERIC_ERROR) } finally { setBusy(null) }
  }

  const Btn = ({ k, icon: Icon, label, onClick, primary }: { k: string; icon: typeof Download; label: string; onClick: () => void; primary?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!!busy}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      style={primary ? { backgroundColor: accent, color: '#fff', borderColor: accent } : { color: accent, borderColor: accent, backgroundColor: '#fff' }}
    >
      {busy === k ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {label}
    </button>
  )

  return (
    <div className="flex flex-col items-stretch lg:items-end gap-2">
      <div className="flex flex-wrap gap-1.5 lg:justify-end">
        <Btn k="pdf-pro" icon={FileText} label="PDF professionista" primary onClick={() => run('pdf-pro', () => download(`${base}/pdf?variant=pro`, `monitoraggio_${date}.pdf`))} />
        <Btn k="pdf-client" icon={FileText} label="PDF cliente" onClick={() => run('pdf-client', () => download(`${base}/pdf?variant=client`, `monitoraggio_cliente_${date}.pdf`))} />
        {!sleep && session.rr_storage_path && (
          <Btn k="rr" icon={Download} label="RR grezzi (CSV)" onClick={() => run('rr', () => download(`${base}/rr-csv`, `rr_${date}.csv`))} />
        )}
        <Btn k="win" icon={Table} label="Finestre (CSV)" onClick={() => run('win', () => download(`${base}/windows-csv`, `finestre_${date}.csv`))} />
        {!readOnly && <Btn k="email" icon={Mail} label="Invia al cliente" onClick={() => setEmailOpen(true)} />}
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-left max-w-sm">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-red-500" />
          <p className="text-[12px] leading-relaxed text-red-800 flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label="Chiudi" className="text-red-400 hover:text-red-700"><X size={13} /></button>
        </div>
      )}
      {emailOpen && <EmailModal session={session} onClose={() => setEmailOpen(false)} />}
    </div>
  )
}

function EmailModal({ session, onClose }: { session: MonitoringSession; onClose: () => void }) {
  const sleep = isSleepSession(session)
  const date = dayNumeric(session.start_time, session.tz_offset_minutes)
  const [subject, setSubject] = useState(sleep ? `Il tuo Report Sonno del ${date}` : `Il tuo Report Monitoraggio del ${date}`)
  const [content, setContent] = useState(
    `Ciao ${session.client_name?.split(' ')[0] ?? ''},\n\nin allegato trovi il report ${sleep ? 'della notte' : 'del monitoraggio'} del ${date}. Lo guardiamo insieme al prossimo incontro.\n\nA presto`,
  )
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/monitoring/${session.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, content }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error ?? GENERIC_ERROR)
      setDone(j?.message ?? 'Messaggio archiviato in cronologia.')
    } catch (e) {
      setError(e instanceof Error ? e.message : GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Invia al cliente"
      description={`Destinatario: ${session.client_name ?? 'Cliente'} · allegato: PDF cliente`}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Chiudi</button>
          {!done && (
            <button type="button" onClick={send} disabled={busy || !subject.trim() || !content.trim()} className="btn-primary text-sm">
              {busy ? 'Invio…' : 'Invia'}
            </button>
          )}
        </div>
      }
    >
      {done ? (
        <div className="px-3 py-2.5 rounded-xl bg-green-50 text-green-700 text-sm">{done}</div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="input-label">Oggetto</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="input-label">Messaggio</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={7} className="input-field resize-y" />
          </div>
          {error && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          <p className="text-xs text-anthracite-lighter">
            Il messaggio viene archiviato nella cronologia del cliente con il link al PDF cliente. L&apos;invio email passa da una Edge Function dedicata (in arrivo): fino ad allora il cliente non riceve una email.
          </p>
        </div>
      )}
    </Modal>
  )
}
