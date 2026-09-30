'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarDays, Download, FileBarChart, Loader2, Mail } from 'lucide-react'
import { formatDate, fullName } from '@/lib/format'
import { apiErrorMessage } from '@/lib/api-error'
import type { Client } from '@/lib/types'

type Preset = '7' | '30' | '90'

// Etichetta in clients.report.preset*.
const PRESETS: Array<{ value: Preset; key: 'presetWeek' | 'presetMonth' | 'presetQuarter'; days: number }> = [
  { value: '7', key: 'presetWeek', days: 7 },
  { value: '30', key: 'presetMonth', days: 30 },
  { value: '90', key: 'presetQuarter', days: 90 },
]

function defaultFrom(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

type GeneratedReport = {
  blobUrl: string
  filename: string
  measurementCount: number
  dateFrom: string
  dateTo: string
}

export function ReportTab({ client }: { client: Client }) {
  const t = useTranslations('clients.report')
  const tErr = useTranslations('errors.api')
  const locale = useLocale()
  const [from, setFrom] = useState(() => defaultFrom(30))
  const [to, setTo] = useState(() => todayIso())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<GeneratedReport | null>(null)

  function applyPreset(p: Preset) {
    const cfg = PRESETS.find((x) => x.value === p)
    if (!cfg) return
    setFrom(defaultFrom(cfg.days))
    setTo(todayIso())
    setReport(null)
  }

  function resetReport() {
    if (report?.blobUrl) URL.revokeObjectURL(report.blobUrl)
    setReport(null)
  }

  async function generate() {
    setError(null)
    setLoading(true)
    resetReport()
    try {
      // ?locale= → il PDF (e i suoi commenti automatici) escono nella lingua della pagina.
      const res = await fetch(
        `/api/pdf/report-periodico?clientId=${encodeURIComponent(client.id)}&from=${from}&to=${to}&locale=${encodeURIComponent(locale)}`,
        { method: 'GET' },
      )
      if (!res.ok) {
        let message = t('genericError')
        try {
          const j = await res.json()
          message = apiErrorMessage(j, tErr, t('genericError'))
        } catch { /* ignore */ }
        throw new Error(message)
      }
      const blob = await res.blob()
      let filename = `StressIndex_Report_${client.cognome ?? client.id}_${from}_${to}.pdf`
      const cd = res.headers.get('Content-Disposition')
      const match = cd?.match(/filename="?([^"]+)"?/i)
      if (match?.[1]) filename = match[1]
      const count = Number(res.headers.get('X-Measurement-Count') ?? '0') || 0
      const blobUrl = URL.createObjectURL(blob)
      setReport({ blobUrl, filename, measurementCount: count, dateFrom: from, dateTo: to })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'))
    } finally {
      setLoading(false)
    }
  }

  function downloadGenerated() {
    if (!report) return
    const a = document.createElement('a')
    a.href = report.blobUrl
    a.download = report.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function mailtoHref(): string {
    if (!client.email) return ''
    const periodLabel = `${formatDate(report?.dateFrom ?? from, 'd MMMM yyyy', locale)} – ${formatDate(report?.dateTo ?? to, 'd MMMM yyyy', locale)}`
    const subject = t('mailSubject', { period: periodLabel })
    const name = (client.nome ?? '').trim()
    const body = [
      name ? t('mailGreeting', { name }) : t('mailGreetingNoName'),
      '',
      t('mailBody', { period: periodLabel }),
      '',
      t('mailClosing'),
    ].join('\n')
    return `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const periodLabel = `${formatDate(from, undefined, locale)} → ${formatDate(to, undefined, locale)}`
  const hasEmail = !!client.email

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-light text-teal-dark flex items-center justify-center flex-shrink-0">
            <FileBarChart size={18} />
          </div>
          <div>
            <h2 className="font-serif text-lg text-anthracite">{t('title')}</h2>
            <p className="text-sm text-anthracite-lighter mt-0.5 max-w-prose">{t('subtitle')}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-anthracite-lighter mb-2">{t('presetsLabel')}</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => applyPreset(p.value)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-surface-border bg-white text-anthracite hover:bg-teal-light hover:border-teal hover:text-teal-dark transition-colors"
                >
                  <CalendarDays size={13} /> {t(p.key)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="input-label">{t('from')}</label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => { setFrom(e.target.value); resetReport() }}
                className="input-field"
              />
            </div>
            <div>
              <label className="input-label">{t('to')}</label>
              <input
                type="date"
                value={to}
                min={from}
                max={todayIso()}
                onChange={(e) => { setTo(e.target.value); resetReport() }}
                className="input-field"
              />
            </div>
          </div>

          <div className="bg-surface rounded-xl p-4 text-sm text-anthracite-light">
            {t('selectedPeriod')} <span className="font-medium text-anthracite">{periodLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-teal text-white hover:bg-teal-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {t('generating')}
                </>
              ) : (
                <>
                  <FileBarChart size={15} />
                  {t('generate')}
                </>
              )}
            </button>
            {error ? <span className="text-sm text-red-500">{error}</span> : null}
          </div>
        </div>
      </section>

      {report ? (
        <section className="card p-6 border-teal/40">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <FileBarChart size={18} />
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-base text-anthracite">{t('ready')}</h3>
              <p className="text-sm text-anthracite-lighter mt-0.5">
                {t('readySummary', {
                  count: report.measurementCount,
                  from: formatDate(report.dateFrom, undefined, locale),
                  to: formatDate(report.dateTo, undefined, locale),
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={downloadGenerated}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-teal text-white hover:bg-teal-dark transition-colors"
            >
              <Download size={15} /> {t('download')}
            </button>

            {hasEmail ? (
              <a
                href={mailtoHref()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-teal text-teal-dark bg-transparent hover:bg-teal-light transition-colors"
              >
                <Mail size={15} /> {t('sendEmail')}
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-dashed border-surface-border text-anthracite-lighter">
                <Mail size={15} /> {t('noEmail')}
              </span>
            )}
          </div>

          {hasEmail ? (
            <p className="text-xs text-anthracite-lighter mt-3 max-w-prose">
              {t('emailHint', { name: fullName(client), email: client.email ?? '' })}
            </p>
          ) : (
            <p className="text-xs text-anthracite-lighter mt-3 max-w-prose">{t('noEmailHint')}</p>
          )}
        </section>
      ) : null}
    </div>
  )
}
