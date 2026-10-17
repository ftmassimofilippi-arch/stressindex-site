'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Eye, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { formatDate, formatMeasuredAt, oggiIta } from '@/lib/format'
import { measurementTypeShortLabel } from '@/lib/measurement-type'
import { panelName } from '@/components/dashboard/AdvancedTrendChart'
import { EXCLUSION_REASONS, isExclusionReason, moveMetric, sameChartView, type ChartPrefs, type ChartView, type ExclusionReason } from '@/lib/chart-view.ts'
import type { Client, MeasurementAnalytics } from '@/lib/types'

// ============================================================================
// "Prepara la vista": gli strumenti del professionista sulla scheda (fase 3b).
// Regola la VISTA, mai i dati: data di inizio percorso, indici e ordine, vista
// salvata per il cliente, annotazioni, esclusioni dai conti con motivo.
// Scritture dirette con il client del browser sotto RLS (stesso schema di
// ClientSettingsTab e NotesTab); dopo ogni scrittura `router.refresh()`
// ricarica i dati dal server. Finché la sito-049 non è applicata
// (`prefs.ready` false) annotazioni, esclusioni e vista salvata restano spenti.
// ============================================================================

type Props = {
  client: Client
  measurements: MeasurementAnalytics[]
  prefs: ChartPrefs
  draft: ChartView
  onDraftChange: (v: ChartView) => void
  onShowClient: () => void
}

export function PrepareViewPanel({ client, measurements, prefs, draft, onDraftChange, onShowClient }: Props) {
  const t = useTranslations('clients.prepare')
  const tCharts = useTranslations('charts')
  const tMetrics = useTranslations('charts.metrics')
  const tTypes = useTranslations('measurement.types')
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [courseStart, setCourseStart] = useState(client.data_inizio_percorso ?? '')
  const [annDay, setAnnDay] = useState(() => oggiIta())
  const [annText, setAnnText] = useState('')
  const [exclSession, setExclSession] = useState('')
  const [exclReason, setExclReason] = useState<ExclusionReason>('artefatti')
  const [exclNote, setExclNote] = useState('')

  const excludedIds = useMemo(() => new Set(prefs.exclusions.map((e) => e.session_id)), [prefs.exclusions])
  const candidates = useMemo(() => measurements.filter((m) => !excludedIds.has(m.session_id)).slice(0, 60), [measurements, excludedIds])
  const bySession = useMemo(() => new Map(measurements.map((m) => [m.session_id, m])), [measurements])

  async function run(label: string, op: () => PromiseLike<{ error: { message: string } | null }>, after?: () => void) {
    setBusy(label); setMsg(null)
    const { error } = await op()
    setBusy(null)
    if (error) { setMsg({ ok: false, text: t('saveError', { message: error.message }) }); return }
    setMsg({ ok: true, text: t('saved') })
    after?.()
    router.refresh()
    setTimeout(() => setMsg(null), 3000)
  }

  const saveCourseStart = () => run('start', () =>
    createClient().from('clients').update({ data_inizio_percorso: courseStart || null }).eq('id', client.id).eq('professionista_id', client.professionista_id))
  const saveView = () => run('view', () => createClient().from('client_settings').upsert({ client_id: client.id, chart_view: draft }))
  const addAnnotation = () => {
    const testo = annText.trim().slice(0, 60)
    if (!annDay || !testo) return
    return run('ann', () => createClient().from('client_chart_annotations').insert({ client_id: client.id, professionista_id: client.professionista_id, giorno: annDay, testo }), () => setAnnText(''))
  }
  const removeAnnotation = (id: string) => run(`ann-${id}`, () => createClient().from('client_chart_annotations').update({ rimossa_at: new Date().toISOString() }).eq('id', id))
  const addExclusion = () => {
    if (!exclSession || !isExclusionReason(exclReason)) return
    return run('excl', () => createClient().from('measurement_exclusions').insert({
      client_id: client.id, professionista_id: client.professionista_id, session_id: exclSession, motivo: exclReason, nota: exclNote.trim() ? exclNote.trim().slice(0, 200) : null,
    }), () => { setExclSession(''); setExclNote('') })
  }
  const restoreExclusion = (id: string) => run(`excl-${id}`, () => createClient().from('measurement_exclusions').update({ revocata_at: new Date().toISOString() }).eq('id', id))

  const viewSaved = prefs.view != null && sameChartView(prefs.view, draft)
  const input = 'text-sm px-2.5 py-1.5 border border-surface-border rounded-lg bg-white text-anthracite focus:outline-none focus:ring-2 focus:ring-teal/30'
  const small = 'px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white border-surface-border text-anthracite hover:bg-surface disabled:opacity-50 whitespace-nowrap'

  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-2 text-sm font-medium text-anthracite" aria-expanded={open}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {t('title')}
        </button>
        <span className="text-xs text-anthracite-lighter hidden sm:inline">{t('subtitle')}</span>
        <button type="button" onClick={onShowClient} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-dark text-white hover:bg-teal">
          <Eye size={14} /> {t('showClient')}
        </button>
      </div>

      {open && (
        <div className="border-t border-surface-border px-5 py-4 space-y-5">
          {!prefs.ready && <p className="callout-amber text-xs">{t('notReady')}</p>}
          {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}

          {/* 1. Inizio del percorso */}
          <div>
            <div className="text-sm font-medium text-anthracite">{t('courseStart')}</div>
            <p className="text-xs text-anthracite-lighter mb-2">{t('courseStartHint')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={courseStart} max={oggiIta()} onChange={(e) => setCourseStart(e.target.value)} className={input} />
              {courseStart && <button type="button" onClick={() => setCourseStart('')} className={small}>{t('clear')}</button>}
              <button type="button" onClick={saveCourseStart} disabled={busy != null || courseStart === (client.data_inizio_percorso ?? '')} className={small}>
                {busy === 'start' ? <Loader2 size={12} className="animate-spin" /> : t('save')}
              </button>
            </div>
          </div>

          {/* 2. Indici e ordine, vista salvata */}
          <div>
            <div className="text-sm font-medium text-anthracite">{t('metricsTitle')}</div>
            <p className="text-xs text-anthracite-lighter mb-2">{t('metricsHint')}</p>
            <ul className="flex flex-wrap gap-1.5">
              {draft.metrics.map((k, i) => (
                <li key={k} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full border border-surface-border bg-white text-xs text-anthracite">
                  <span>{i + 1}. {panelName(k, tCharts, tMetrics)}</span>
                  <button type="button" aria-label={t('up')} disabled={i === 0} onClick={() => onDraftChange({ ...draft, metrics: moveMetric(draft.metrics, k, -1) })} className="p-0.5 rounded hover:bg-surface disabled:opacity-30"><ArrowUp size={12} /></button>
                  <button type="button" aria-label={t('down')} disabled={i === draft.metrics.length - 1} onClick={() => onDraftChange({ ...draft, metrics: moveMetric(draft.metrics, k, 1) })} className="p-0.5 rounded hover:bg-surface disabled:opacity-30"><ArrowDown size={12} /></button>
                  <button type="button" aria-label={t('remove')} disabled={draft.metrics.length <= 1} onClick={() => onDraftChange({ ...draft, metrics: draft.metrics.filter((x) => x !== k) })} className="p-0.5 rounded hover:bg-surface disabled:opacity-30"><X size={12} /></button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button type="button" onClick={saveView} disabled={!prefs.ready || busy != null || viewSaved} className={small}>
                {busy === 'view' ? <Loader2 size={12} className="animate-spin" /> : viewSaved ? t('viewSaved') : t('saveView')}
              </button>
              <span className="text-xs text-anthracite-lighter">{t('viewHint')}</span>
            </div>
          </div>

          {/* 3. Annotazioni */}
          <div>
            <div className="text-sm font-medium text-anthracite">{t('annotationsTitle')}</div>
            <p className="text-xs text-anthracite-lighter mb-2">{t('annotationsHint')}</p>
            {prefs.annotations.length === 0 ? (
              <p className="text-xs text-anthracite-lighter mb-2">{t('noAnnotations')}</p>
            ) : (
              <ul className="space-y-1 mb-2">
                {prefs.annotations.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm text-anthracite">
                    <span className="text-anthracite-lighter tabular-nums">{formatDate(a.day, undefined, locale)}</span>
                    <span className="font-medium">{a.text}</span>
                    <button type="button" onClick={() => removeAnnotation(a.id)} disabled={busy != null} className="ml-1 p-0.5 rounded hover:bg-surface text-anthracite-lighter" aria-label={t('remove')}><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={annDay} max={oggiIta()} onChange={(e) => setAnnDay(e.target.value)} className={input} disabled={!prefs.ready} />
              <input type="text" value={annText} maxLength={60} onChange={(e) => setAnnText(e.target.value)} placeholder={t('annotationPlaceholder')} className={`${input} flex-1 min-w-[12rem]`} disabled={!prefs.ready} />
              <button type="button" onClick={addAnnotation} disabled={!prefs.ready || busy != null || !annText.trim()} className={small}>
                {busy === 'ann' ? <Loader2 size={12} className="animate-spin" /> : t('add')}
              </button>
            </div>
          </div>

          {/* 4. Esclusioni */}
          <div>
            <div className="text-sm font-medium text-anthracite">{t('exclusionsTitle')}</div>
            <p className="text-xs text-anthracite-lighter mb-2">{t('exclusionsHint')}</p>
            {prefs.exclusions.length === 0 ? (
              <p className="text-xs text-anthracite-lighter mb-2">{t('noExclusions')}</p>
            ) : (
              <ul className="space-y-1 mb-2">
                {prefs.exclusions.map((e) => {
                  const m = bySession.get(e.session_id)
                  return (
                    <li key={e.id} className="flex items-center gap-2 text-sm text-anthracite flex-wrap">
                      <span className="tabular-nums">{m ? formatMeasuredAt(m, locale) : e.session_id}</span>
                      {m && <span className="text-xs text-anthracite-lighter">{measurementTypeShortLabel(m.test_type, tTypes)}</span>}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">{t(`reasons.${e.motivo}`)}{e.nota ? ` · ${e.nota}` : ''}</span>
                      <button type="button" onClick={() => restoreExclusion(e.id)} disabled={busy != null} className={small}>{t('restore')}</button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select value={exclSession} onChange={(e) => setExclSession(e.target.value)} className={`${input} max-w-full`} disabled={!prefs.ready}>
                <option value="">{t('exclusionPick')}</option>
                {candidates.map((m) => (
                  <option key={m.session_id} value={m.session_id}>{formatMeasuredAt(m, locale)} · {measurementTypeShortLabel(m.test_type, tTypes)}</option>
                ))}
              </select>
              <select value={exclReason} onChange={(e) => setExclReason(e.target.value as ExclusionReason)} className={input} disabled={!prefs.ready}>
                {EXCLUSION_REASONS.map((r) => <option key={r} value={r}>{t(`reasons.${r}`)}</option>)}
              </select>
              <input type="text" value={exclNote} maxLength={200} onChange={(e) => setExclNote(e.target.value)} placeholder={t('exclusionNote')} className={`${input} flex-1 min-w-[10rem]`} disabled={!prefs.ready} />
              <button type="button" onClick={addExclusion} disabled={!prefs.ready || busy != null || !exclSession} className={small}>
                {busy === 'excl' ? <Loader2 size={12} className="animate-spin" /> : t('exclude')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
