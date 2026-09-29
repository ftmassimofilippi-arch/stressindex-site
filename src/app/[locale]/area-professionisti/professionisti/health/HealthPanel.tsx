'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { formatDate, formatRelative } from '@/lib/format'
import { api, errorText } from '../adminApi'

// ============================================================================
// Health check dei dati — 6 indicatori, ognuno calcolato lato DB in una sola
// chiamata (RPC admin_data_health, migration 017). Stile Notion-like: elenco
// verticale di card minimali, il dettaglio si apre solo se serve.
// ============================================================================

type Section<T> = { count: number; items: T[] }

type LinkedClientNoData = {
  link_id: string
  professional_id: string
  professional_name: string
  client_user_id: string
  user_email: string | null
  display_name: string
  crm_id: string | null
  reason: 'no_crm_match' | 'no_measurements'
}
type OrphanSessions = { user_id: string; email: string | null; name: string | null; sessions_count: number; last_at: string | null }
type DuplicateClients = {
  professionista_id: string
  professional_name: string
  email: string
  rows_count: number
  rows: Array<{ id: string; nome: string | null; cognome: string | null; created_at: string | null; client_user_id: string | null }>
}
type ClientNoEmail = { id: string; name: string | null; professional_name: string; created_at: string | null }
type AppVersion = { app_version: string; platform: string; users_count: number; last_seen_at: string | null }
type StalePending = { link_id: string; created_at: string; client_name: string | null; client_email: string | null; professional_name: string }

type Report = {
  linked_clients_no_data: Section<LinkedClientNoData>
  orphan_remote_sessions: Section<OrphanSessions>
  duplicate_clients: Section<DuplicateClients>
  clients_no_email: Section<ClientNoEmail>
  app_versions: { available: boolean; items: AppVersion[] }
  stale_pending_links: Section<StalePending>
  generated_at: string
}

export function HealthPanel({ serviceRoleConfigured }: { serviceRoleConfigured: boolean }) {
  const t = useTranslations('admin.healthCheck')
  const ta = useTranslations('admin')
  const tErr = useTranslations('errors.api')
  const locale = useLocale()
  const [report, setReport] = useState<Report | null>(null)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { ok, json } = await api('GET', '/api/admin/health')
    if (json?.migration_required) setMigrationRequired(true)
    else if (ok) setReport(json?.report ?? null)
    else setError(errorText(json, tErr, t('loadError')))
    setLoading(false)
  }, [t, tErr])

  useEffect(() => {
    if (serviceRoleConfigured) reload()
    else setLoading(false)
  }, [serviceRoleConfigured, reload])

  const code = (c: React.ReactNode) => <code className="px-1 bg-surface rounded">{c}</code>

  if (!serviceRoleConfigured) {
    return (
      <div className="card p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-sm text-anthracite-lighter">{ta.rich('serviceRole.healthBody', { code })}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card p-12 flex items-center justify-center text-anthracite-lighter">
        <Loader2 className="animate-spin mr-2" size={18} /> {t('analyzing')}
      </div>
    )
  }

  if (migrationRequired) {
    return (
      <div className="card p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-medium text-anthracite">{t('migrationTitle')}</h3>
            <p className="text-sm text-anthracite-lighter mt-1">{t.rich('migrationBody', { code })}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="callout-amber text-sm">
        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
        <span>{error ?? t('unavailable')}</span>
      </div>
    )
  }

  const problemCount =
    report.linked_clients_no_data.count +
    report.orphan_remote_sessions.count +
    report.duplicate_clients.count +
    report.clients_no_email.count +
    report.stale_pending_links.count

  const REASON_LABEL: Record<LinkedClientNoData['reason'], string> = {
    no_crm_match: t('reasonNoCrm'),
    no_measurements: t('reasonNoMeasurements'),
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-anthracite-lighter">
          {problemCount === 0 ? t('noProblems') : t('toVerify', { count: problemCount })}{' '}
          {t('generated', { when: formatRelative(report.generated_at, locale) })}
        </p>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-surface-border hover:bg-surface text-anthracite-lighter"
        >
          <RefreshCw size={15} /> {ta('refresh')}
        </button>
      </div>

      <IndicatorCard
        title={t('linkedNoData')}
        subtitle={t('linkedNoDataSub')}
        count={report.linked_clients_no_data.count}
      >
        <SimpleTable
          headers={[t('thClient'), t('thProfessional'), t('thProblem')]}
          rows={report.linked_clients_no_data.items.map((i) => [
            <CellMain key="a" main={i.display_name} sub={i.user_email} />,
            i.professional_name,
            <span key="c" className={i.reason === 'no_crm_match' ? 'text-red-500' : 'text-amber-600'}>{REASON_LABEL[i.reason]}</span>,
          ])}
          empty={t('empty')}
        />
      </IndicatorCard>

      <IndicatorCard
        title={t('orphan')}
        subtitle={t('orphanSub')}
        count={report.orphan_remote_sessions.count}
      >
        <SimpleTable
          headers={[t('thUser'), t('thSessions'), t('thLast')]}
          rows={report.orphan_remote_sessions.items.map((i) => [
            <CellMain key="a" main={i.name ?? i.email ?? i.user_id} sub={i.name ? i.email : null} />,
            String(i.sessions_count),
            i.last_at ? formatRelative(i.last_at, locale) : '—',
          ])}
          empty={t('empty')}
        />
      </IndicatorCard>

      <IndicatorCard
        title={t('duplicates')}
        subtitle={t('duplicatesSub')}
        count={report.duplicate_clients.count}
      >
        <SimpleTable
          headers={[t('thEmail'), t('thProfessional'), t('thRows')]}
          rows={report.duplicate_clients.items.map((i) => [
            <CellMain key="a" main={i.email} sub={i.rows.map((r) => `${r.nome ?? ''} ${r.cognome ?? ''}`.trim() || r.id).join(' · ')} />,
            i.professional_name,
            String(i.rows_count),
          ])}
          empty={t('empty')}
        />
      </IndicatorCard>

      <IndicatorCard
        title={t('noEmail')}
        subtitle={t('noEmailSub')}
        count={report.clients_no_email.count}
      >
        <SimpleTable
          headers={[t('thClient'), t('thProfessional'), t('thCreated')]}
          rows={report.clients_no_email.items.map((i) => [
            i.name ?? i.id,
            i.professional_name,
            i.created_at ? formatDate(i.created_at, undefined, locale) : '—',
          ])}
          empty={t('empty')}
        />
      </IndicatorCard>

      <IndicatorCard
        title={t('appVersions')}
        subtitle={t('appVersionsSub')}
        count={report.app_versions.available ? report.app_versions.items.length : null}
        neutral
      >
        {report.app_versions.available ? (
          <SimpleTable
            headers={[t('thVersion'), t('thPlatform'), t('thUsers'), t('thLastSeen')]}
            rows={report.app_versions.items.map((i) => [
              i.app_version,
              i.platform,
              String(i.users_count),
              i.last_seen_at ? formatRelative(i.last_seen_at, locale) : '—',
            ])}
            empty={t('empty')}
          />
        ) : (
          <p className="text-sm text-anthracite-lighter px-4 pb-4">{t.rich('appVersionsUnavailable', { code })}</p>
        )}
      </IndicatorCard>

      <IndicatorCard
        title={t('stalePending')}
        subtitle={t('stalePendingSub')}
        count={report.stale_pending_links.count}
      >
        <SimpleTable
          headers={[t('thClient'), t('thProfessional'), t('thPendingSince')]}
          rows={report.stale_pending_links.items.map((i) => [
            <CellMain key="a" main={i.client_name ?? i.client_email ?? '—'} sub={i.client_name ? i.client_email : null} />,
            i.professional_name,
            formatRelative(i.created_at, locale),
          ])}
          empty={t('empty')}
        />
      </IndicatorCard>
    </div>
  )
}

// ── Componenti di presentazione ──────────────────────────────────────────────

function IndicatorCard({
  title,
  subtitle,
  count,
  neutral = false,
  children,
}: {
  title: string
  subtitle: string
  count: number | null // null = dato non disponibile
  neutral?: boolean // per sezioni informative (non problemi)
  children: React.ReactNode
}) {
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const ok = !neutral && count === 0
  const expandable = count === null || count > 0 || neutral

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => expandable && setOpen(!open)}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left ${expandable ? 'hover:bg-surface/50' : 'cursor-default'} transition-colors`}
      >
        <span className="flex-shrink-0">
          {ok ? (
            <CheckCircle2 size={18} className="text-green-500" />
          ) : expandable && open ? (
            <ChevronDown size={18} className="text-anthracite-lighter" />
          ) : (
            <ChevronRight size={18} className={ok ? 'text-green-500' : 'text-anthracite-lighter'} />
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-anthracite">{title}</span>
          <span className="block text-xs text-anthracite-lighter mt-0.5">{subtitle}</span>
        </span>
        <span
          className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            count === null
              ? 'bg-surface text-anthracite-lighter'
              : neutral
                ? 'bg-teal-light text-teal-dark'
                : count === 0
                  ? 'bg-green-50 text-green-600'
                  : 'bg-amber-50 text-amber-600'
          }`}
        >
          {count === null ? tc('na') : count}
        </span>
      </button>
      {open && expandable && <div className="border-t border-surface-border">{children}</div>}
    </div>
  )
}

function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-anthracite-lighter px-5 py-4">{empty}</p>
  }
  return (
    <div className="overflow-x-auto max-h-80 overflow-y-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-surface text-anthracite-lighter sticky top-0">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-5 py-2.5 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-t border-surface-border">
              {cells.map((c, j) => (
                <td key={j} className="px-5 py-2.5 align-top text-anthracite">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CellMain({ main, sub }: { main: React.ReactNode; sub?: React.ReactNode | null }) {
  return (
    <div>
      <div className="font-medium text-anthracite">{main}</div>
      {sub && <div className="text-xs text-anthracite-lighter mt-0.5 break-words">{sub}</div>}
    </div>
  )
}
