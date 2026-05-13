'use client'

import { useState } from 'react'
import { Download, Mail, MoreHorizontal, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Alert, Client, ClientNote, ClientSettings, MeasurementAnalytics, Message, ProfessionalProfile } from '@/lib/types'
import { age, fullName, initials } from '@/lib/format'
import { OverviewTab } from './tabs/OverviewTab'
import { MeasurementsTab } from './tabs/MeasurementsTab'
import { AdvancedAnalyticsTab } from './tabs/AdvancedAnalyticsTab'
import { NotesTab } from './tabs/NotesTab'
import { MessagesTab } from './tabs/MessagesTab'
import { ClientSettingsTab } from './tabs/ClientSettingsTab'
import { PdfExportModal } from './PdfExportModal'
import { MessageComposer } from './MessageComposer'

const TABS = [
  { id: 'panoramica', label: 'Panoramica' },
  { id: 'misurazioni', label: 'Misurazioni' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'note', label: 'Note' },
  { id: 'messaggi', label: 'Messaggi' },
  { id: 'impostazioni', label: 'Impostazioni' },
] as const

type TabId = typeof TABS[number]['id']

type Props = {
  client: Client
  measurements: MeasurementAnalytics[]
  alerts: Alert[]
  notes: ClientNote[]
  settings: ClientSettings | null
  messages: Message[]
  professional: ProfessionalProfile | null
}

export function ClientProfile({ client, measurements, alerts, notes, settings, messages, professional }: Props) {
  const [tab, setTab] = useState<TabId>('panoramica')
  const [pdfOpen, setPdfOpen] = useState(false)
  const [msgOpen, setMsgOpen] = useState(false)
  const latest = measurements[0]

  const totalMeasurements = measurements.length
  const memberSince = client.created_at ? Math.floor((Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null

  return (
    <>
      <div className="mb-6">
        <Link href="/area-professionisti/clienti" className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite transition-colors">
          <ArrowLeft size={14} /> Clienti
        </Link>
      </div>

      <section className="card p-6 mb-6 sticky top-16 z-10 bg-white/95 backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-lg font-semibold flex-shrink-0">
              {initials(client)}
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl text-anthracite truncate">{fullName(client) || 'Senza nome'}</h1>
              <div className="text-sm text-anthracite-lighter mt-0.5">
                {age(client.data_nascita) != null && `${age(client.data_nascita)} anni · `}
                {client.sesso === 'M' ? 'Uomo' : client.sesso === 'F' ? 'Donna' : ''}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(settings?.tags ?? []).map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full text-[11px] bg-teal-light text-teal-dark">{t}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden lg:block w-px bg-surface-border" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">Stress</div>
              <div className="font-serif text-2xl text-anthracite mt-0.5">{latest?.score_stress != null ? Math.round(latest.score_stress) : '—'}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">Recupero</div>
              <div className="font-serif text-2xl text-anthracite mt-0.5">{latest?.score_recupero != null ? Math.round(latest.score_recupero) : '—'}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">Misurazioni</div>
              <div className="font-serif text-2xl text-anthracite mt-0.5">{totalMeasurements}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter">In carico da</div>
              <div className="font-serif text-2xl text-anthracite mt-0.5">{memberSince != null ? `${memberSince}gg` : '—'}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPdfOpen(true)} className="btn-secondary text-sm inline-flex items-center gap-1.5">
              <Download size={15} /> PDF
            </button>
            <button type="button" onClick={() => setMsgOpen(true)} className="btn-secondary text-sm inline-flex items-center gap-1.5">
              <Mail size={15} /> Messaggio
            </button>
            <button type="button" className="w-10 h-10 rounded-xl border border-surface-border hover:bg-surface flex items-center justify-center" aria-label="Altre azioni">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </section>

      <div className="flex gap-1 border-b border-surface-border mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? 'border-teal text-teal-dark' : 'border-transparent text-anthracite-lighter hover:text-anthracite'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'panoramica' && <OverviewTab client={client} measurements={measurements} alerts={alerts} />}
      {tab === 'misurazioni' && <MeasurementsTab client={client} measurements={measurements} />}
      {tab === 'analytics' && <AdvancedAnalyticsTab measurements={measurements} />}
      {tab === 'note' && <NotesTab client={client} initialNotes={notes} />}
      {tab === 'messaggi' && <MessagesTab client={client} initialMessages={messages} />}
      {tab === 'impostazioni' && <ClientSettingsTab client={client} initialSettings={settings} />}

      <PdfExportModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        client={client}
        measurements={measurements}
        notes={notes}
        professional={professional}
      />

      <MessageComposer open={msgOpen} onClose={() => setMsgOpen(false)} client={client} />
    </>
  )
}
