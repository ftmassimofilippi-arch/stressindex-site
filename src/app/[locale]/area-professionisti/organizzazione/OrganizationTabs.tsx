'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { Activity, Mail, Pencil, Save, Trash2, UserPlus, Users } from 'lucide-react'
import { formatRelative, formatMeasuredAt, initials } from '@/lib/format'
import { apiErrorMessage } from '@/lib/api-error'
import { ScoreBar } from '@/components/dashboard/ScoreBar'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { Modal } from '@/components/dashboard/Modal'
import type {
  Organization,
  OrganizationMember,
  OrgMemberStats,
  OrgOverview,
} from '@/lib/dashboard-data'

type Props = {
  organization: Organization
  members: OrganizationMember[]
  role: 'owner' | 'admin' | 'member'
  stats: OrgMemberStats[]
  overview: OrgOverview | null
}

const TAB_IDS = ['team', 'panoramica', 'professionisti'] as const

type TabId = typeof TAB_IDS[number]

export function OrganizationTabs({ organization, members, role, stats, overview }: Props) {
  const t = useTranslations('organization.tabs')
  const [tab, setTab] = useState<TabId>('team')
  const labels: Record<TabId, string> = { team: t('team'), panoramica: t('overview'), professionisti: t('professionals') }
  return (
    <>
      <div className="flex gap-1 border-b border-surface-border mb-6 overflow-x-auto">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === id ? 'border-teal text-teal-dark' : 'border-transparent text-anthracite-lighter hover:text-anthracite'
            }`}
          >
            {labels[id]}
          </button>
        ))}
      </div>
      {tab === 'team' && <TeamTab organization={organization} members={members} role={role} stats={stats} />}
      {tab === 'panoramica' && <PanoramicaTab overview={overview} />}
      {tab === 'professionisti' && <ProfessionistiTab stats={stats} />}
    </>
  )
}

function TeamTab({
  organization,
  members,
  role,
  stats,
}: {
  organization: Organization
  members: OrganizationMember[]
  role: 'owner' | 'admin' | 'member'
  stats: OrgMemberStats[]
}) {
  const t = useTranslations('organization')
  const locale = useLocale()
  const router = useRouter()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(organization.name)
  const [savingName, setSavingName] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [busyMember, setBusyMember] = useState<string | null>(null)

  const statsByUser = new Map(stats.map((s) => [s.user_id, s]))

  async function saveName() {
    setSavingName(true)
    const res = await fetch('/api/organization', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setSavingName(false)
    if (res.ok) {
      setEditingName(false)
      router.refresh()
    }
  }

  async function changeRole(memberId: string, newRole: string) {
    setBusyMember(memberId)
    await fetch(`/api/organization/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    setBusyMember(null)
    router.refresh()
  }

  async function revokeMember() {
    if (!revokeId) return
    setBusyMember(revokeId)
    await fetch(`/api/organization/members/${revokeId}`, { method: 'DELETE' })
    setBusyMember(null)
    setRevokeId(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-3">{t('team.organization')}</h2>
        {editingName && role === 'owner' ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field flex-1 min-w-[200px]" />
            <button onClick={saveName} disabled={savingName} className="btn-primary text-sm inline-flex items-center gap-1.5">
              <Save size={15} /> {t('team.save')}
            </button>
            <button onClick={() => { setName(organization.name); setEditingName(false) }} className="btn-secondary text-sm">
              {t('team.cancel')}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-lg text-anthracite">{organization.name}</div>
            {role === 'owner' && (
              <button onClick={() => setEditingName(true)} className="text-anthracite-lighter hover:text-anthracite p-1">
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-teal" />
            <h2 className="font-serif text-lg text-anthracite">{t('team.members')}</h2>
          </div>
          {(role === 'owner' || role === 'admin') && (
            <button onClick={() => setInviteOpen(true)} className="btn-primary text-sm inline-flex items-center gap-1.5">
              <UserPlus size={15} /> {t('team.invite')}
            </button>
          )}
        </div>
        <div className="px-6 py-3 bg-amber-50/40 border-b border-surface-border text-xs text-anthracite-lighter">
          {t('team.inviteNote')}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-surface text-anthracite-lighter">
              <tr>
                <th className="text-left px-6 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('team.thProfessional')}</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('team.thRole')}</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('team.thStatus')}</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('team.thClients')}</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('team.thLastActivity')}</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const stat = m.user_id ? statsByUser.get(m.user_id) : null
                const isMe = m.role === 'owner' && m.user_id // assume owner is current user if owner
                return (
                  <tr key={m.id} className="border-t border-surface-border">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {stat?.full_name ? initials({ nome: stat.full_name.split(' ')[0], cognome: stat.full_name.split(' ').slice(1).join(' ') }) : (m.email[0]?.toUpperCase() ?? '?')}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-anthracite truncate">{stat?.full_name || m.email}</div>
                          <div className="text-xs text-anthracite-lighter truncate">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {role === 'owner' && m.role !== 'owner' ? (
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m.id, e.target.value)}
                          disabled={busyMember === m.id}
                          className="px-2.5 py-1.5 text-xs bg-white border border-surface-border rounded-lg"
                        >
                          <option value="member">{t('roles.member')}</option>
                          <option value="admin">{t('roles.admin')}</option>
                        </select>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-light text-teal-dark whitespace-nowrap">
                          {t(`roles.${m.role}`)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-3 py-3 text-anthracite">{stat?.clients_count ?? '—'}</td>
                    <td className="px-3 py-3 text-anthracite-lighter text-xs">
                      {stat?.last_activity ? formatRelative(stat.last_activity, locale) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {role === 'owner' && m.role !== 'owner' && !isMe && (
                        <button
                          onClick={() => setRevokeId(m.id)}
                          disabled={busyMember === m.id}
                          className="text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                          title={t('team.remove')}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ConfirmDialog
        open={!!revokeId}
        onClose={() => setRevokeId(null)}
        onConfirm={revokeMember}
        title={t('team.removeTitle')}
        description={t('team.removeDescription')}
        confirmText={t('team.removeConfirm')}
        destructive
      />
    </div>
  )
}

function StatusBadge({ status }: { status: OrganizationMember['status'] }) {
  const t = useTranslations('organization.memberStatus')
  const cls: Record<OrganizationMember['status'], string> = {
    active: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    revoked: 'bg-surface text-anthracite-lighter',
  }
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${cls[status]}`}>{t(status)}</span>
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('organization.inviteDialog')
  const tr = useTranslations('organization.roles')
  const tc = useTranslations('common')
  const tErr = useTranslations('errors.api')
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    const res = await fetch('/api/organization/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErr(apiErrorMessage(data, tErr))
      return
    }
    setEmail('')
    onClose()
    router.refresh()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('title')}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="input-label">{t('email')}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('placeholder')}
            className="input-field"
            autoFocus
          />
        </div>
        <div>
          <label className="input-label">{t('role')}</label>
          <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')} className="input-field">
            <option value="member">{tr('member')}</option>
            <option value="admin">{tr('admin')}</option>
          </select>
          <p className="text-xs text-anthracite-lighter mt-1">{t('roleHelp')}</p>
        </div>
        {err && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
        <div className="flex justify-end gap-2 flex-wrap">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">{tc('cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
            <Mail size={15} /> {saving ? t('sending') : t('send')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function PanoramicaTab({ overview }: { overview: OrgOverview | null }) {
  const t = useTranslations('organization.overview')
  const locale = useLocale()
  if (!overview) return null
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label={t('professionals')} value={overview.total_professionals} hint={t('professionalsHint')} />
        <MetricCard label={t('totalClients')} value={overview.total_clients} />
        <MetricCard label={t('totalMeasurements')} value={overview.total_measurements} />
        <MetricCard label={t('measurements')} value={overview.measurements_this_week} hint={t('measurementsHint')} />
      </div>

      <section className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border flex items-center gap-2">
          <Activity size={18} className="text-teal" />
          <h2 className="font-serif text-lg text-anthracite">{t('recent')}</h2>
        </div>
        {overview.recent.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-anthracite-lighter">{t('empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-surface text-anthracite-lighter">
                <tr>
                  <th className="text-left px-6 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('thProfessional')}</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('thClient')}</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('thDate')}</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">{t('thStress')}</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {overview.recent.map((r) => (
                  <tr key={r.session_id} className="border-t border-surface-border">
                    <td className="px-6 py-3 text-anthracite">{r.professional_name}</td>
                    <td className="px-3 py-3 font-medium text-anthracite">{r.client_name}</td>
                    <td className="px-3 py-3 text-anthracite-lighter whitespace-nowrap">{formatMeasuredAt(r, locale)}</td>
                    <td className="px-3 py-3 w-40"><ScoreBar value={r.score_stress} inverted /></td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/area-professionisti/clienti/${r.client_id}/misurazione/${r.session_id}?professionista=${r.professional_id}`}
                        className="text-teal-dark text-sm hover:underline whitespace-nowrap"
                      >
                        {t('open')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function ProfessionistiTab({ stats }: { stats: OrgMemberStats[] }) {
  const t = useTranslations('organization.professionals')
  const locale = useLocale()
  return (
    <section className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-border">
        <h2 className="font-serif text-lg text-anthracite">{t('title')}</h2>
        <p className="text-xs text-anthracite-lighter mt-1">{t('help')}</p>
      </div>
      {stats.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-anthracite-lighter">{t('empty')}</div>
      ) : (
        <ul className="divide-y divide-surface-border">
          {stats.map((s) => (
            <li key={s.user_id}>
              <Link
                href={`/area-professionisti/clienti?professionista=${s.user_id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-surface transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {s.full_name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-anthracite truncate">{s.full_name}</div>
                  <div className="text-xs text-anthracite-lighter truncate">{s.email ?? ''}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-anthracite">{s.clients_count}</div>
                  <div className="text-[11px] text-anthracite-lighter">{t('clients')}</div>
                </div>
                <div className="text-right ml-6 hidden sm:block">
                  <div className="text-sm font-medium text-anthracite">{s.measurements_count}</div>
                  <div className="text-[11px] text-anthracite-lighter">{t('measurements')}</div>
                </div>
                <div className="text-right ml-6 hidden md:block">
                  <div className="text-xs text-anthracite-lighter">
                    {s.last_activity ? formatRelative(s.last_activity, locale) : '—'}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
