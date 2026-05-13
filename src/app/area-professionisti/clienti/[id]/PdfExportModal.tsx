'use client'

import { useMemo, useState } from 'react'
import { Modal } from '@/components/dashboard/Modal'
import type { Client, ClientNote, ProfessionalProfile, Session } from '@/lib/types'
import { fullName, formatDate, formatDateTime } from '@/lib/format'

type Props = {
  open: boolean
  onClose: () => void
  client: Client
  sessions: Session[]
  notes: ClientNote[]
  professional: ProfessionalProfile | null
}

const SCORE_OPTIONS = [
  { key: 'stress_score', label: 'Stress' },
  { key: 'recovery_score', label: 'Recupero' },
  { key: 'balance_score', label: 'Equilibrio' },
  { key: 'energy_score', label: 'Energia' },
] as const

export function PdfExportModal({ open, onClose, client, sessions, notes, professional }: Props) {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [scores, setScores] = useState<Record<string, boolean>>({ stress_score: true, recovery_score: true, balance_score: true, energy_score: true })
  const [includeHrv, setIncludeHrv] = useState(false)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [includeHeader, setIncludeHeader] = useState(true)
  const [loading, setLoading] = useState(false)

  const filteredSessions = useMemo(() => {
    const fMs = new Date(from).getTime()
    const tMs = new Date(to).getTime() + 24 * 3600 * 1000
    return sessions.filter((s) => {
      const t = new Date(s.created_at).getTime()
      return t >= fMs && t <= tMs
    })
  }, [sessions, from, to])

  async function generate() {
    setLoading(true)
    try {
      // dynamic import per evitare SSR di @react-pdf
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
                <Text style={styles.h1}>Stress Index — Report Cliente</Text>
                <Text style={styles.muted}>
                  {professional?.nome ?? ''} {professional?.cognome ?? ''}
                  {professional?.nome_studio ? ` · ${professional.nome_studio}` : ''}
                </Text>
                <Text style={styles.muted}>Generato il {formatDate(new Date(), 'd MMMM yyyy')}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.h2}>Anagrafica</Text>
              <View style={styles.kv}><Text>Nome</Text><Text>{fullName(client)}</Text></View>
              <View style={styles.kv}><Text>Email</Text><Text>{client.email ?? '—'}</Text></View>
              <View style={styles.kv}><Text>Sesso</Text><Text>{client.sesso ?? '—'}</Text></View>
              <View style={styles.kv}><Text>Data di nascita</Text><Text>{client.data_nascita ?? '—'}</Text></View>
              <View style={styles.kv}><Text>Periodo report</Text><Text>{from} → {to}</Text></View>
              <View style={styles.kv}><Text>Misurazioni nel periodo</Text><Text>{filteredSessions.length}</Text></View>
            </View>

            <View style={styles.section}>
              <Text style={styles.h2}>Misurazioni</Text>
              <View style={styles.row}>
                <Text style={[styles.col, { fontWeight: 700 }]}>Data</Text>
                {SCORE_OPTIONS.filter(o => scores[o.key]).map((o) => (
                  <Text key={o.key} style={[styles.col, { fontWeight: 700 }]}>{o.label}</Text>
                ))}
              </View>
              {filteredSessions.map((s) => (
                <View key={s.id} style={styles.row}>
                  <Text style={styles.col}>{formatDateTime(s.created_at)}</Text>
                  {SCORE_OPTIONS.filter(o => scores[o.key]).map((o) => {
                    const v = (s as any)[o.key]
                    return <Text key={o.key} style={styles.col}>{v != null ? Number(v).toFixed(0) : '—'}</Text>
                  })}
                </View>
              ))}
              {filteredSessions.length === 0 && <Text style={styles.muted}>Nessuna misurazione nel periodo</Text>}
            </View>

            {includeHrv && filteredSessions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.h2}>Parametri HRV (ultima misurazione)</Text>
                {(() => {
                  const s = filteredSessions[0]
                  const fields: Array<[string, string | number | null | undefined]> = [
                    ['Mean RR', s.mean_rr], ['SDNN', s.sdnn], ['RMSSD', s.rmssd], ['pNN50', s.pnn50],
                    ['BPM medio', s.bpm_mean], ['VLF', s.vlf], ['LF', s.lf], ['HF', s.hf], ['LF/HF', s.lf_hf_ratio],
                    ['SD1', s.sd1], ['SD2', s.sd2], ['DFA α1', s.dfa_alpha1], ['Sample Entropy', s.sample_entropy],
                  ]
                  return fields.map(([k, v]) => (
                    <View key={k} style={styles.kv}><Text>{k}</Text><Text>{v != null ? Number(v).toFixed(2) : '—'}</Text></View>
                  ))
                })()}
              </View>
            )}

            {includeNotes && notes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.h2}>Note cliniche</Text>
                {notes.slice(0, 10).map((n) => (
                  <View key={n.id} style={styles.noteBlock}>
                    <Text style={styles.muted}>{formatDate(n.created_at, 'd MMMM yyyy')}{(n.tags ?? []).length ? ` · ${(n.tags ?? []).join(', ')}` : ''}</Text>
                    <Text>{n.content}</Text>
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
      a.download = `report-${client.cognome ?? client.id}-${formatDate(new Date(), 'yyyy-MM-dd')}.pdf`
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
      title="Esporta report PDF"
      description={`Cliente: ${fullName(client)}`}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Annulla</button>
          <button type="button" onClick={generate} disabled={loading} className="btn-primary text-sm">
            {loading ? 'Generazione…' : 'Genera PDF'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Dal</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="input-label">Al</label>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input-field" />
          </div>
        </div>

        <div>
          <label className="input-label">Indici da includere</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SCORE_OPTIONS.map((o) => (
              <label key={o.key} className="flex items-center gap-2 text-sm bg-surface px-3 py-2 rounded-lg cursor-pointer">
                <input type="checkbox" checked={scores[o.key]} onChange={(e) => setScores({ ...scores, [o.key]: e.target.checked })} className="w-4 h-4 rounded text-teal" />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeHrv} onChange={(e) => setIncludeHrv(e.target.checked)} className="w-4 h-4 rounded text-teal" />
            Includere parametri HRV completi
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} className="w-4 h-4 rounded text-teal" />
            Includere note cliniche
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeHeader} onChange={(e) => setIncludeHeader(e.target.checked)} className="w-4 h-4 rounded text-teal" />
            Intestazione professionista
          </label>
        </div>

        <div className="bg-surface rounded-xl p-4 text-xs text-anthracite-lighter">
          <p>Anteprima: il PDF includerà <b>{filteredSessions.length}</b> misurazioni nel periodo, intestazione studio
          {professional?.nome_studio ? ` "${professional.nome_studio}"` : ''}, ed eventualmente le note cliniche. I grafici PSD, Poincaré e ritmogramma sono in arrivo con la generazione server-side.</p>
        </div>
      </div>
    </Modal>
  )
}
