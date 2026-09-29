'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Download, Mail, MoreHorizontal, ArrowLeft } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import type { Alert, Client, ClientNote, ClientSettings, MeasurementAnalytics, Message, ProfessionalProfile } from '@/lib/types'
import { age, fullName, initials } from '@/lib/format'
import { OverviewTab } from './tabs/OverviewTab'
import { MeasurementsTab } from './tabs/MeasurementsTab'
import { BeforeAfterTab } from './tabs/BeforeAfterTab'
import { MonitoringTab } from './tabs/MonitoringTab'
import type { MonitoringSession } from '@/lib/monitoring-types'
import { AdvancedAnalyticsTab } from './tabs/AdvancedAnalyticsTab'
import { NotesTab, noteCategoryLabel, noteTagLabel } from './tabs/NotesTab'
import { MessagesTab } from './tabs/MessagesTab'
import { ReportTab } from './tabs/ReportTab'
import { ClientSettingsTab } from './tabs/ClientSettingsTab'
import { PdfExportModal } from './PdfExportModal'
import { MessageComposer } from './MessageComposer'
import { SuperadminAccessLog } from '@/components/dashboard/SuperadminAccessLog'
import { formatDate } from '@/lib/format'
import type { AlertRule } from '@/lib/alert-rules'

// Id delle tab (stabili, usati anche nel deep link ?tab=) e chiave del nome
// in `clients.tabs.*`.
const ALL_TABS = [
  { id: 'panoramica', key: 'overview' },
  { id: 'misurazioni', key: 'measurements' },
  { id: 'prima-dopo', key: 'beforeAfter' },
  { id: 'monitoraggi', key: 'monitoring' },
  { id: 'analytics', key: 'analytics' },
  { id: 'report', key: 'report' },
  { id: 'note', key: 'notes' },
  { id: 'messaggi', key: 'messages' },
  { id: 'impostazioni', key: 'settings' },
] as const

const READONLY_TABS = ALL_TABS.filter((t) => t.id !== 'messaggi' && t.id !== 'impostazioni')

type TabId = typeof ALL_TABS[number]['id']

type Props = {
  client: Client
  measurements: MeasurementAnalytics[]
  monitoring?: MonitoringSession[]
  alerts: Alert[]
  notes: ClientNote[]
  settings: ClientSettings | null
  messages: Message[]
  professional: ProfessionalProfile | null
  readOnly?: boolean
  viewingMemberName?: string
  professionistaId?: string
  superadminAccess?: boolean
  adminId?: string
  /** Regole di alert_rules del professionista (generali + override). */
  alertRules?: AlertRule[]
  /** Utente loggato: serve per scrivere gli override su alert_rules. */
  currentUserId?: string
}

export function ClientProfile({ client, measurements, monitoring = [], alerts, notes, settings, messages, professional, readOnly, viewingMemberName, professionistaId, superadminAccess, adminId, alertRules = [], currentUserId }: Props) {
  const t = useTranslations('clients.profile')
  const tTabs = useTranslations('clients.tabs')
  const tScores = useTranslations('scores')
  const [tab, setTab] = useState<TabId>('panoramica')
  const TABS = readOnly ? READONLY_TABS : ALL_TABS
  const backHref = professionistaId
    ? `/area-professionisti/clienti?professionista=${professionistaId}`
    : '/area-professionisti/clienti'
  const [pdfOpen, setPdfOpen] = useState(false)
  const [msgOpen, setMsgOpen] = useState(false)
  const latest = measurements[0]

  const totalMeasurements = measurements.length
  const memberSince = client.created_at ? Math.floor((Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null
  const years = age(client.data_nascita)
  const sexLabel = client.sesso === 'M' ? t('sexM') : client.sesso === 'F' ? t('sexF') : ''
  const subtitle = [years != null ? t('age', { n: years }) : '', sexLabel].filter(Boolean).join(' · ')

  return (
    <>
      {superadminAccess && adminId && professionistaId && (
        <SuperadminAccessLog adminId={adminId} professionistaId={professionistaId} professionalName={viewingMemberName} />
      )}
      {readOnly && viewingMemberName && (
        <div className="mb-4 flex items-center gap-3 flex-wrap px-5 py-3 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="text-sm text-amber-800">
            {t.rich(superadminAccess ? 'viewingSupport' : 'viewingReadOnly', {
              name: viewingMemberName,
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </div>
          <Link
            href={superadminAccess ? '/area-professionisti/professionisti' : '/area-professionisti/organizzazione'}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:underline"
          >
            <ArrowLeft size={14} /> {superadminAccess ? t('backToProfessionals') : t('backToTeam')}
          </Link>
        </div>
      )}
      <div className="mb-6">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-anthracite-lighter hover:text-anthracite transition-colors">
          <ArrowLeft size={14} /> {t('backToClients')}
        </Link>
      </div>

      <section className="card p-6 mb-6 sticky top-16 z-10 bg-white/95 backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-lg font-semibold flex-shrink-0">
              {initials(client)}
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl text-anthracite truncate">{fullName(client) || t('unnamed')}</h1>
              <div className="text-sm text-anthracite-lighter mt-0.5">{subtitle}</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(settings?.tags ?? []).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] bg-teal-light text-teal-dark">{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden lg:block w-px bg-surface-border" />

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1 min-w-0">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter truncate">{tScores('names.stress')}</div>
              <div className="font-serif text-2xl text-anthracite mt-0.5">{latest?.score_stress != null ? Math.round(latest.score_stress) : '—'}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter truncate">{tScores('names.recovery')}</div>
              <div className="font-serif text-2xl text-anthracite mt-0.5">{latest?.score_recupero != null ? Math.round(latest.score_recupero) : '—'}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter truncate">{t('statMeasurements')}</div>
              <div className="font-serif text-2xl text-anthracite mt-0.5">{totalMeasurements}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter truncate">{t('statMonitoring')}</div>
              <div className="font-serif text-2xl text-anthracite mt-0.5">{monitoring.length}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-anthracite-lighter truncate">{t('statSince')}</div>
              <div className="font-serif text-2xl text-anthracite mt-0.5">{memberSince != null ? t('daysShort', { count: memberSince }) : '—'}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setPdfOpen(true)} className="btn-secondary text-sm inline-flex items-center gap-1.5">
              <Download size={15} /> {t('pdf')}
            </button>
            {!readOnly && (
              <>
                <button type="button" onClick={() => setMsgOpen(true)} className="btn-secondary text-sm inline-flex items-center gap-1.5">
                  <Mail size={15} /> {t('message')}
                </button>
                <button type="button" className="w-10 h-10 rounded-xl border border-surface-border hover:bg-surface flex items-center justify-center" aria-label={t('moreActions')}>
                  <MoreHorizontal size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="flex gap-1 border-b border-surface-border mb-6 overflow-x-auto">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === tb.id ? 'border-teal text-teal-dark' : 'border-transparent text-anthracite-lighter hover:text-anthracite'
            }`}
          >
            {tTabs(tb.key)}
          </button>
        ))}
      </div>

      {tab === 'panoramica' && <OverviewTab client={client} measurements={measurements} monitoring={monitoring} alerts={alerts} professionistaId={professionistaId} />}
      {tab === 'misurazioni' && <MeasurementsTab client={client} measurements={measurements} professionistaId={professionistaId} />}
      {tab === 'prima-dopo' && <BeforeAfterTab client={client} measurements={measurements} professionistaId={professionistaId} />}
      {tab === 'monitoraggi' && <MonitoringTab sessions={monitoring} professionistaId={professionistaId} />}
      {tab === 'analytics' && <AdvancedAnalyticsTab measurements={measurements} />}
      {tab === 'report' && <ReportTab client={client} />}
      {!readOnly && tab === 'note' && <NotesTab client={client} initialNotes={notes} />}
      {readOnly && tab === 'note' && <ReadOnlyNotesList notes={notes} />}
      {!readOnly && tab === 'messaggi' && <MessagesTab client={client} initialMessages={messages} />}
      {!readOnly && tab === 'impostazioni' && <ClientSettingsTab client={client} initialSettings={settings} alertRules={alertRules} professionalId={currentUserId ?? null} />}

      <PdfExportModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        client={client}
        measurements={measurements}
        notes={notes}
        professional={professional}
      />

      {!readOnly && <MessageComposer open={msgOpen} onClose={() => setMsgOpen(false)} client={client} />}
    </>
  )
}

function ReadOnlyNotesList({ notes }: { notes: ClientNote[] }) {
  const t = useTranslations('notes')
  const locale = useLocale()
  if (notes.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-anthracite-lighter">
        {t('noneForClient')}
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {notes.map((n) => (
        <li key={n.id} className="card p-5">
          <div className="flex items-center gap-2 text-xs text-anthracite-lighter mb-2">
            <span>{formatDate(n.data_creazione, undefined, locale)}</span>
            {n.categoria && (
              <>
                <span>·</span>
                <span className="px-2 py-0.5 rounded-full bg-teal-light text-teal-dark">{noteCategoryLabel(n.categoria, t)}</span>
              </>
            )}
          </div>
          <p className="text-sm text-anthracite whitespace-pre-wrap">{n.testo}</p>
          {n.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {n.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] bg-surface text-anthracite-lighter">{noteTagLabel(tag, t)}</span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
