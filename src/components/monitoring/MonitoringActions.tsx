'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertCircle, Download, FileText, Loader2, Mail, Table, X } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { apiErrorMessage } from '@/lib/api-error'
import type { MonitoringSession } from '@/lib/monitoring-types'
import { isSleepSession } from '@/lib/monitoring-types'
import { MON, dayMedium, dayNumeric } from '@/lib/monitoring-format'

// Azioni del dettaglio (3.10): PDF professionista, PDF cliente, export RR
// grezzi (dal bucket), export finestre, invio al cliente. Tutte le route
// stanno in /api/monitoring/[id]/*. La lingua corrente viaggia come
// `?locale=` così PDF, CSV ed errori escono nella lingua della pagina.

type ErrT = ((key: string, values?: Record<string, string | number | Date>) => string) & { has?: (key: string) => boolean }

async function download(url: string, fallbackName: string, genericError: string, te: ErrT) {
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    let message = genericError
    try { message = apiErrorMessage(await res.json(), te, genericError) } catch { /* non JSON */ }
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
  const t = useTranslations('monitoring')
  const tc = useTranslations('common')
  const te = useTranslations('errors.api')
  const locale = useLocale()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const sleep = isSleepSession(session)
  const base = `/api/monitoring/${session.id}`
  const accent = sleep ? MON.sleep : MON.accent
  const date = dayNumeric(session.start_time, session.tz_offset_minutes).replace(/\//g, '-')
  const generic = t('actions.genericError')
  const q = (extra = '') => `?locale=${locale}${extra}`

  async function run(key: string, fn: () => Promise<void>) {
    if (busy) return
    setBusy(key)
    setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : generic) } finally { setBusy(null) }
  }

  const Btn = ({ k, icon: Icon, label, onClick, primary }: { k: string; icon: typeof Download; label: string; onClick: () => void; primary?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!!busy}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-60 disabled:cursor-not-allowed max-w-full"
      style={primary ? { backgroundColor: accent, color: '#fff', borderColor: accent } : { color: accent, borderColor: accent, backgroundColor: '#fff' }}
    >
      {busy === k ? <Loader2 size={14} className="animate-spin flex-shrink-0" /> : <Icon size={14} className="flex-shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
  )

  return (
    <div className="flex flex-col items-stretch lg:items-end gap-2 min-w-0">
      <div className="flex flex-wrap gap-1.5 lg:justify-end">
        <Btn k="pdf-pro" icon={FileText} label={t('actions.pdfPro')} primary onClick={() => run('pdf-pro', () => download(`${base}/pdf${q('&variant=pro')}`, `monitoring_${date}.pdf`, generic, te))} />
        <Btn k="pdf-client" icon={FileText} label={t('actions.pdfClient')} onClick={() => run('pdf-client', () => download(`${base}/pdf${q('&variant=client')}`, `monitoring_client_${date}.pdf`, generic, te))} />
        {!sleep && session.rr_storage_path && (
          <Btn k="rr" icon={Download} label={t('actions.rrCsv')} onClick={() => run('rr', () => download(`${base}/rr-csv${q()}`, `rr_${date}.csv`, generic, te))} />
        )}
        <Btn k="win" icon={Table} label={t('actions.windowsCsv')} onClick={() => run('win', () => download(`${base}/windows-csv${q()}`, `windows_${date}.csv`, generic, te))} />
        {!readOnly && <Btn k="email" icon={Mail} label={t('actions.sendToClient')} onClick={() => setEmailOpen(true)} />}
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-left max-w-sm">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-red-500" />
          <p className="text-[12px] leading-relaxed text-red-800 flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label={tc('close')} className="text-red-400 hover:text-red-700"><X size={13} /></button>
        </div>
      )}
      {emailOpen && <EmailModal session={session} onClose={() => setEmailOpen(false)} />}
    </div>
  )
}

function EmailModal({ session, onClose }: { session: MonitoringSession; onClose: () => void }) {
  const t = useTranslations('monitoring')
  const tc = useTranslations('common')
  const te = useTranslations('errors.api')
  const locale = useLocale()
  const sleep = isSleepSession(session)
  const date = dayMedium(session.start_time, session.tz_offset_minutes, locale)
  const firstName = session.client_name?.split(' ')[0] ?? ''
  const [subject, setSubject] = useState(sleep ? t('email.subjectSleep', { date }) : t('email.subjectMonitoring', { date }))
  const [content, setContent] = useState(sleep ? t('email.bodySleep', { name: firstName, date }) : t('email.bodyMonitoring', { name: firstName, date }))
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generic = t('actions.genericError')

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/monitoring/${session.id}/email?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, content }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(apiErrorMessage(j, te, generic))
      setDone(j?.code === 'monitoring_email_archived' ? t('email.routeArchived') : t('email.archived'))
    } catch (e) {
      setError(e instanceof Error ? e.message : generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('email.title')}
      description={t('email.description', { name: session.client_name ?? t('client') })}
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">{tc('close')}</button>
          {!done && (
            <button type="button" onClick={send} disabled={busy || !subject.trim() || !content.trim()} className="btn-primary text-sm">
              {busy ? t('email.sending') : t('email.send')}
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
            <label className="input-label">{t('email.subject')}</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('email.message')}</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={7} className="input-field resize-y" />
          </div>
          {error && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          <p className="text-xs text-anthracite-lighter">{t('email.note')}</p>
        </div>
      )}
    </Modal>
  )
}
