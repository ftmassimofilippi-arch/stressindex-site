'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Modal } from '@/components/dashboard/Modal'
import type { Client, ClientNote, MeasurementAnalytics, ProfessionalProfile } from '@/lib/types'
import { fullName, formatDate, formatMeasuredAt, num } from '@/lib/format'
import { measuredInstant } from '@/lib/format'
import { noteCategoryLabel, noteTagLabel } from './tabs/NotesTab'

type Props = {
  open: boolean
  onClose: () => void
  client: Client
  measurements: MeasurementAnalytics[]
  notes: ClientNote[]
  professional: ProfessionalProfile | null
}

// Colonna DB → chiave del nome in `scores.names.*`.
const SCORE_OPTIONS = [
  { key: 'score_stress', nameKey: 'stress' },
  { key: 'score_recupero', nameKey: 'recovery' },
  { key: 'score_equilibrio', nameKey: 'balance' },
  { key: 'score_energia', nameKey: 'energy' },
] as const

export function PdfExportModal({ open, onClose, client, measurements, notes, professional }: Props) {
  const t = useTranslations('clients.pdfExport')
  const tScores = useTranslations('scores')
  const tNotes = useTranslations('notes')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [scores, setScores] = useState<Record<string, boolean>>({ score_stress: true, score_recupero: true, score_equilibrio: true, score_energia: true })
  const [includeHrv, setIncludeHrv] = useState(false)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [includeHeader, setIncludeHeader] = useState(true)
  const [loading, setLoading] = useState(false)

  const filteredMeasurements = useMemo(() => {
    const fMs = new Date(from).getTime()
    const tMs = new Date(to).getTime() + 24 * 3600 * 1000
    return measurements.filter((m) => {
      const t = measuredInstant(m)?.getTime() ?? 0
      return t >= fMs && t <= tMs
    })
  }, [measurements, from, to])

  function sexLabel(sesso: string | null | undefined): string {
    if (sesso === 'M') return t('doc.sexM')
    if (sesso === 'F') return t('doc.sexF')
    if (sesso === 'X') return t('doc.sexX')
    return sesso ?? '—'
  }

  async function generate() {
    setLoading(true)
    try {
      const { pdf, Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')

      const styles = StyleSheet.create({
        page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#2F343A' },
        header: { borderBottom: '1px solid #E2E6EA', paddingBottom: 10, marginBottom: 16 },
        h1: { fontSize: 18, marginBottom: 4 },
        h2: { fontSize: 13, marginTop: 14, marginBottom: 6, color: '#2E746C' },
        muted: { color: '#6B7280', fontSize: 9 },
        row: { flexDirection: 'row', borderBottom: '1px solid #F1F4F7', paddingVertical: 4 },
        col: { flexGrow: 1 },
        small: { fontSize: 9 },
        section: { marginBottom: 12 },
        kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
        noteBlock: { marginBottom: 8, padding: 8, backgroundColor: '#F6F7F8' },
      })

      const Report = (
        <Document>
          <Page size="A4" style={styles.page}>
            {includeHeader && (
              <View style={styles.header}>
                <Text style={styles.h1}>{t('doc.title')}</Text>
                <Text style={styles.muted}>
                  {professional?.nome ?? ''} {professional?.cognome ?? ''}
                  {professional?.nome_studio ? ` · ${professional.nome_studio}` : ''}
                </Text>
                <Text style={styles.muted}>{t('doc.generatedOn', { date: formatDate(new Date(), 'd MMMM yyyy', locale) })}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.h2}>{t('doc.personal')}</Text>
              <View style={styles.kv}><Text>{t('doc.name')}</Text><Text>{fullName(client)}</Text></View>
              <View style={styles.kv}><Text>{t('doc.email')}</Text><Text>{client.email ?? '—'}</Text></View>
              <View style={styles.kv}><Text>{t('doc.sex')}</Text><Text>{sexLabel(client.sesso)}</Text></View>
              <View style={styles.kv}><Text>{t('doc.birthDate')}</Text><Text>{client.data_nascita ? formatDate(client.data_nascita, undefined, locale) : '—'}</Text></View>
              <View style={styles.kv}><Text>{t('doc.period')}</Text><Text>{formatDate(from, undefined, locale)} → {formatDate(to, undefined, locale)}</Text></View>
              <View style={styles.kv}><Text>{t('doc.countInPeriod')}</Text><Text>{filteredMeasurements.length}</Text></View>
            </View>

            <View style={styles.section}>
              <Text style={styles.h2}>{t('doc.measurements')}</Text>
              <View style={styles.row}>
                <Text style={[styles.col, { fontWeight: 700 }]}>{t('doc.date')}</Text>
                {SCORE_OPTIONS.filter(o => scores[o.key]).map((o) => (
                  <Text key={o.key} style={[styles.col, { fontWeight: 700 }]}>{tScores(`names.${o.nameKey}`)}</Text>
                ))}
              </View>
              {filteredMeasurements.map((m) => (
                <View key={m.id} style={styles.row}>
                  <Text style={styles.col}>{formatMeasuredAt(m, locale)}</Text>
                  {SCORE_OPTIONS.filter(o => scores[o.key]).map((o) => {
                    const v = m[o.key as keyof MeasurementAnalytics] as number | null
                    return <Text key={o.key} style={styles.col}>{v != null ? num(v, 0, locale) : '—'}</Text>
                  })}
                </View>
              ))}
              {filteredMeasurements.length === 0 && <Text style={styles.muted}>{t('doc.none')}</Text>}
            </View>

            {includeHrv && filteredMeasurements.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.h2}>{t('doc.hrvTitle')}</Text>
                {(() => {
                  const m = filteredMeasurements[0]
                  // Sigle HRV invariate in tutte le lingue; solo "BPM medio" è tradotto.
                  const fields: Array<[string, number | null]> = [
                    ['Mean RR', m.mean_rr], ['SDNN', m.sdnn], ['RMSSD', m.rmssd], ['pNN50', m.pnn50],
                    [t('doc.meanBpm'), m.mean_hr], ['VLF', m.vlf_power], ['LF', m.lf_power], ['HF', m.hf_power], ['LF/HF', m.lf_hf_ratio],
                    ['SD1', m.sd1], ['SD2', m.sd2], ['DFA α1', m.dfa_alpha1], ['SampEn', m.sample_entropy],
                    ['Baevsky SI', m.stress_index_baevsky],
                  ]
                  return fields.map(([k, v]) => (
                    <View key={k} style={styles.kv}><Text>{k}</Text><Text>{v != null ? num(v, 2, locale) : '—'}</Text></View>
                  ))
                })()}
              </View>
            )}

            {includeNotes && notes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.h2}>{t('doc.notesTitle')}</Text>
                {notes.slice(0, 10).map((n) => (
                  <View key={n.id} style={styles.noteBlock}>
                    <Text style={styles.muted}>
                      {formatDate(n.data_creazione, 'd MMMM yyyy', locale)}
                      {n.categoria ? ` · ${noteCategoryLabel(n.categoria, tNotes)}` : ''}
                      {(n.tags ?? []).length ? ` · ${(n.tags ?? []).map((tag) => noteTagLabel(tag, tNotes)).join(', ')}` : ''}
                    </Text>
                    <Text>{n.testo}</Text>
                  </View>
                ))}
              </View>
            )}
          </Page>
        </Document>
      )

      const blob = await pdf(Report).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${t('fileName')}-${client.cognome ?? client.id}-${formatDate(new Date(), 'yyyy-MM-dd')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('title')}
      description={t('client', { name: fullName(client) })}
      size="lg"
      footer={
        <div className="flex justify-end gap-2 flex-wrap">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">{tCommon('cancel')}</button>
          <button type="button" onClick={generate} disabled={loading} className="btn-primary text-sm">
            {loading ? t('generating') : t('generate')}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">{t('from')}</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('to')}</label>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input-field" />
          </div>
        </div>

        <div>
          <label className="input-label">{t('indices')}</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SCORE_OPTIONS.map((o) => (
              <label key={o.key} className="flex items-center gap-2 text-sm bg-surface px-3 py-2 rounded-lg cursor-pointer min-w-0">
                <input type="checkbox" checked={scores[o.key]} onChange={(e) => setScores({ ...scores, [o.key]: e.target.checked })} className="w-4 h-4 rounded text-teal" />
                <span className="truncate">{tScores(`names.${o.nameKey}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeHrv} onChange={(e) => setIncludeHrv(e.target.checked)} className="w-4 h-4 rounded text-teal" />
            {t('includeHrv')}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} className="w-4 h-4 rounded text-teal" />
            {t('includeNotes')}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeHeader} onChange={(e) => setIncludeHeader(e.target.checked)} className="w-4 h-4 rounded text-teal" />
            {t('includeHeader')}
          </label>
        </div>

        <div className="bg-surface rounded-xl p-4 text-xs text-anthracite-lighter">
          <p>
            {t.rich('preview', {
              count: filteredMeasurements.length,
              studio: professional?.nome_studio ? ` "${professional.nome_studio}"` : '',
              b: (chunks) => <b>{chunks}</b>,
            })}
          </p>
        </div>
      </div>
    </Modal>
  )
}
