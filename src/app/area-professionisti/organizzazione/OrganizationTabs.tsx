'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Activity, Mail, Pencil, Save, Trash2, UserPlus, Users } from 'lucide-react'
import { formatRelative, formatDateTime, initials } from '@/lib/format'
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

const TABS = [
  { id: 'team', label: 'Team' },
  { id: 'panoramica', label: 'Panoramica' },
  { id: 'professionisti', label: 'Professionisti' },
] as const

type TabId = typeof TABS[number]['id']

export function OrganizationTabs({ organization, members, role, stats, overview }: Props) {
  const [tab, setTab] = useState<TabId>('team')
  return (
    <>
      <div className="flex gap-1 border-b border-surface-border mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-teal text-teal-dark' : 'border-transparent text-anthracite-lighter hover:text-anthracite'
            }`}
          >
            {t.label}
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
        <h2 className="font-serif text-lg text-anthracite mb-3">Organizzazione</h2>
        {editingName && role === 'owner' ? (
          <div className="flex items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field flex-1" />
            <button onClick={saveName} disabled={savingName} className="btn-primary text-sm inline-flex items-center gap-1.5">
              <Save size={15} /> Salva
            </button>
            <button onClick={() => { setName(organization.name); setEditingName(false) }} className="btn-secondary text-sm">
              Annulla
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
            <h2 className="font-serif text-lg text-anthracite">Membri del team</h2>
          </div>
          {(role === 'owner' || role === 'admin') && (
            <button onClick={() => setInviteOpen(true)} className="btn-primary text-sm inline-flex items-center gap-1.5">
              <UserPlus size={15} /> Invita professionista
            </button>
          )}
        </div>
        <div className="px-6 py-3 bg-amber-50/40 border-b border-surface-border text-xs text-anthracite-lighter">
          L&apos;invito verrà accettato quando il professionista accede alla dashboard.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-anthracite-lighter">
              <tr>
                <th className="text-left px-6 py-2.5 text-[11px] uppercase tracking-wide font-medium">Professionista</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Ruolo</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Stato</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Clienti</th>
                <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Ultima attività</th>
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
                        <div className="w-8 h-8 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-xs font-semibold">
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
                          <option value="member">Professionista</option>
                          <option value="admin">Amministratore</option>
                        </select>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-light text-teal-dark">
                          {roleLabel(m.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-3 py-3 text-anthracite">{stat?.clients_count ?? '—'}</td>
                    <td className="px-3 py-3 text-anthracite-lighter text-xs">
                      {stat?.last_activity ? formatRelative(stat.last_activity) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {role === 'owner' && m.role !== 'owner' && !isMe && (
                        <button
                          onClick={() => setRevokeId(m.id)}
                          disabled={busyMember === m.id}
                          className="text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                          title="Rimuovi membro"
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
        title="Rimuovere il membro?"
        description="Il professionista perderà l'accesso all'organizzazione. I suoi clienti e misurazioni restano nel suo account."
        confirmText="Rimuovi"
        destructive
      />
    </div>
  )
}

function StatusBadge({ status }: { status: OrganizationMember['status'] }) {
  const map: Record<OrganizationMember['status'], { label: string; cls: string }> = {
    active: { label: 'Attivo', cls: 'bg-emerald-50 text-emerald-700' },
    pending: { label: 'In attesa', cls: 'bg-amber-50 text-amber-700' },
    revoked: { label: 'Revocato', cls: 'bg-surface text-anthracite-lighter' },
  }
  const { label, cls } = map[status]
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

function roleLabel(r: OrganizationMember['role']) {
  return r === 'owner' ? 'Titolare' : r === 'admin' ? 'Amministratore' : 'Professionista'
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      setErr(translateError(data?.error))
      return
    }
    setEmail('')
    onClose()
    router.refresh()
  }

  return (
    <Modal open={open} onClose={onClose} title="Invita professionista">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="input-label">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="collega@studio.it"
            className="input-field"
            autoFocus
          />
        </div>
        <div>
          <label className="input-label">Ruolo</label>
          <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')} className="input-field">
            <option value="member">Professionista</option>
            <option value="admin">Amministratore</option>
          </select>
          <p className="text-xs text-anthracite-lighter mt-1">
            Gli amministratori possono invitare altri professionisti.
          </p>
        </div>
        {err && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Annulla</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
            <Mail size={15} /> {saving ? 'Invio…' : 'Invita'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function translateError(err?: string) {
  switch (err) {
    case 'invalid_email': return 'Email non valida'
    case 'already_invited': return 'Questo professionista è già stato invitato'
    case 'forbidden': return 'Non hai i permessi per questa operazione'
    default: return err ?? 'Errore'
  }
}

function PanoramicaTab({ overview }: { overview: OrgOverview | null }) {
  if (!overview) return null
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Professionisti" value={overview.total_professionals} hint="attivi" />
        <MetricCard label="Clienti totali" value={overview.total_clients} />
        <MetricCard label="Misurazioni totali" value={overview.total_measurements} />
        <MetricCard label="Misurazioni" value={overview.measurements_this_week} hint="ultimi 7 giorni" />
      </div>

      <section className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border flex items-center gap-2">
          <Activity size={18} className="text-teal" />
          <h2 className="font-serif text-lg text-anthracite">Attività recente</h2>
        </div>
        {overview.recent.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-anthracite-lighter">
            Nessuna misurazione ancora registrata
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-anthracite-lighter">
                <tr>
                  <th className="text-left px-6 py-2.5 text-[11px] uppercase tracking-wide font-medium">Professionista</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Cliente</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Data</th>
                  <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wide font-medium">Stress</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {overview.recent.map((r) => (
                  <tr key={r.session_id} className="border-t border-surface-border">
                    <td className="px-6 py-3 text-anthracite">{r.professional_name}</td>
                    <td className="px-3 py-3 font-medium text-anthracite">{r.client_name}</td>
                    <td className="px-3 py-3 text-anthracite-lighter">{formatDateTime(r.measured_at)}</td>
                    <td className="px-3 py-3 w-40"><ScoreBar value={r.score_stress} inverted /></td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/area-professionisti/clienti/${r.client_id}/misurazione/${r.session_id}?professionista=${r.professional_id}`}
                        className="text-teal-dark text-sm hover:underline"
                      >
                        Apri →
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
  return (
    <section className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-border">
        <h2 className="font-serif text-lg text-anthracite">Professionisti</h2>
        <p className="text-xs text-anthracite-lighter mt-1">
          Clicca un professionista per vedere i suoi clienti e misurazioni (sola lettura).
        </p>
      </div>
      {stats.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-anthracite-lighter">
          Nessun professionista attivo. Invita qualcuno dal tab Team.
        </div>
      ) : (
        <ul className="divide-y divide-surface-border">
          {stats.map((s) => (
            <li key={s.user_id}>
              <Link
                href={`/area-professionisti/clienti?professionista=${s.user_id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-surface transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-sm font-semibold">
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
                  <div className="text-[11px] text-anthracite-lighter">clienti</div>
                </div>
                <div className="text-right ml-6 hidden sm:block">
                  <div className="text-sm font-medium text-anthracite">{s.measurements_count}</div>
                  <div className="text-[11px] text-anthracite-lighter">misurazioni</div>
                </div>
                <div className="text-right ml-6 hidden md:block">
                  <div className="text-xs text-anthracite-lighter">
                    {s.last_activity ? formatRelative(s.last_activity) : '—'}
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

