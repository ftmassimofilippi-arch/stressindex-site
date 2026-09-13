'use client'

import { useMemo, useState } from 'react'
import {
  CalendarPlus, Link2, MoreHorizontal, PanelRight, PauseCircle, PlayCircle, Search, ShieldCheck, Ban, AlertTriangle, Clock,
} from 'lucide-react'
import { formatRelative } from '@/lib/format'
import type { AdminUser } from '@/lib/admin-data'
import type { AccountModulo, AccountStato } from '@/lib/admin-commerciale'
import { type AdminIssue, ADMIN_ISSUE_HINTS, ADMIN_ISSUE_LABELS, ADMIN_ISSUE_ORDER, ADMIN_ISSUE_TONE } from '@/lib/admin-issues'
import type { Toast } from './adminApi'
import { ManualLinkModal } from './ManualLinkModal'
import { UserSidePanel } from './UserSidePanel'
import {
  accountAction, MenuItem, MenuLabel, ModuleIcons, moduleIcon, PianoPill, pianoNome, ReasonDialog, RowMenu, ScadenzaCell, scadenzaLivello,
  STATO_LABEL, StatoDot, type Catalogo,
} from './commerciale-ui'

type ProfessionalOption = { id: string; name: string; email: string | null }

function IssueBadge({ issue }: { issue: AdminIssue }) {
  const tone = ADMIN_ISSUE_TONE[issue]
  const cls = tone === 'red' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'
  const Icon = issue === 'pending_link' ? Clock : AlertTriangle
  return (
    <span title={ADMIN_ISSUE_HINTS[issue]} className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap ${cls}`}>
      <Icon size={10} /> {ADMIN_ISSUE_LABELS[issue]}
    </span>
  )
}

type Pending =
  | { kind: 'status'; user: AdminUser; stato: Exclude<AccountStato, 'prova'> }
  | { kind: 'module'; user: AdminUser; m: AccountModulo; abilitato: boolean }
  | null

export function UsersTab({
  users,
  catalogo,
  professionals,
  onChanged,
  showToast,
  initialFilter,
}: {
  users: AdminUser[]
  catalogo: Catalogo | null
  professionals: ProfessionalOption[]
  onChanged: () => void
  showToast: (t: Toast) => void
  initialFilter?: { scadenza30?: boolean; stato?: AccountStato }
}) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'professional' | 'client'>('all')
  const [statoFilter, setStatoFilter] = useState<'all' | AccountStato>(initialFilter?.stato ?? 'all')
  const [pianoFilter, setPianoFilter] = useState<string>('all')
  const [moduloFilter, setModuloFilter] = useState<string>('all')
  const [scadenza30, setScadenza30] = useState(!!initialFilter?.scadenza30)
  const [issueFilter, setIssueFilter] = useState<'all' | 'any' | AdminIssue>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linkUser, setLinkUser] = useState<AdminUser | null>(null)
  const [menu, setMenu] = useState<{ user: AdminUser; anchor: HTMLElement } | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const hasCommerciale = !!catalogo
  const selected = useMemo(() => users.find((u) => u.id === selectedId) ?? null, [users, selectedId])

  const issueCounts = useMemo(() => {
    const counts = new Map<AdminIssue, number>()
    for (const u of users) if (u.issue) counts.set(u.issue, (counts.get(u.issue) ?? 0) + 1)
    return counts
  }, [users])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return users.filter((u) => {
      if (s && !`${u.full_name} ${u.email ?? ''}`.toLowerCase().includes(s)) return false
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (issueFilter === 'any' && !u.issue) return false
      if (issueFilter !== 'all' && issueFilter !== 'any' && u.issue !== issueFilter) return false
      const c = u.commerciale
      if (statoFilter !== 'all' && c?.stato !== statoFilter) return false
      if (pianoFilter !== 'all' && (c?.piano ?? (hasCommerciale ? null : u.plan)) !== pianoFilter) return false
      if (moduloFilter !== 'all' && !c?.moduli.some((m) => m.codice === moduloFilter && m.attivo)) return false
      if (scadenza30) {
        const g = c?.giorni_alla_scadenza
        if (g === null || g === undefined || g > 30 || c?.stato === 'sospeso' || c?.stato === 'bloccato') return false
      }
      return true
    })
  }, [users, search, roleFilter, issueFilter, statoFilter, pianoFilter, moduloFilter, scadenza30, hasCommerciale])

  async function extend(u: AdminUser, mesi: number) {
    setMenu(null)
    setBusyId(u.id)
    const ok = await accountAction(u.id, { action: 'extend', mesi, motivo: `Prolungamento rapido +${mesi === 12 ? '1 anno' : `${mesi} ${mesi === 1 ? 'mese' : 'mesi'}`}` }, showToast, `${u.full_name}: abbonamento prolungato`)
    setBusyId(null)
    if (ok) onChanged()
  }

  const selectCls = 'px-2.5 py-1.5 text-[13px] bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 text-anthracite'

  return (
    <div className="space-y-3">
      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o email…"
            className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)} className={selectCls}>
          <option value="all">Tutti i ruoli</option>
          <option value="professional">Professionisti</option>
          <option value="client">Clienti</option>
        </select>
        {hasCommerciale && (
          <>
            <select value={statoFilter} onChange={(e) => setStatoFilter(e.target.value as typeof statoFilter)} className={selectCls}>
              <option value="all">Tutti gli stati</option>
              {(Object.keys(STATO_LABEL) as AccountStato[]).map((s) => <option key={s} value={s}>{STATO_LABEL[s]}</option>)}
            </select>
            <select value={pianoFilter} onChange={(e) => setPianoFilter(e.target.value)} className={selectCls}>
              <option value="all">Tutti i piani</option>
              {catalogo.piani.map((p) => <option key={p.codice} value={p.codice}>{p.nome}</option>)}
            </select>
            <select value={moduloFilter} onChange={(e) => setModuloFilter(e.target.value)} className={selectCls}>
              <option value="all">Tutti i moduli</option>
              {catalogo.moduli.map((m) => <option key={m.codice} value={m.codice}>Con {m.nome}</option>)}
            </select>
            <label className={`inline-flex items-center gap-1.5 text-[13px] px-2.5 py-1.5 rounded-lg border cursor-pointer ${scadenza30 ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-surface-border bg-white text-anthracite'}`}>
              <input type="checkbox" className="sr-only" checked={scadenza30} onChange={(e) => setScadenza30(e.target.checked)} />
              <CalendarPlus size={13} /> In scadenza entro 30 giorni
            </label>
          </>
        )}
        {!hasCommerciale && (
          <select value={pianoFilter} onChange={(e) => setPianoFilter(e.target.value)} className={selectCls}>
            <option value="all">Tutti i piani</option>
            <option value="pro">Pro</option>
            <option value="base">Base</option>
          </select>
        )}
        <select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value as typeof issueFilter)} className={selectCls}>
          <option value="all">Tutte le situazioni</option>
          <option value="any">Solo da sistemare</option>
          {ADMIN_ISSUE_ORDER.map((k) => <option key={k} value={k}>{ADMIN_ISSUE_LABELS[k]} ({issueCounts.get(k) ?? 0})</option>)}
        </select>
        <span className="text-[12px] text-anthracite-lighter ml-auto">{filtered.length} di {users.length}</span>
      </div>

      {!hasCommerciale && (
        <div className="text-[13px] px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-100">
          Stato account, scadenze e moduli non disponibili: applica la migration 024.
        </div>
      )}

      {/* Tabella */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[980px]">
            <thead>
              <tr className="text-left text-[12px] text-anthracite-lighter border-b border-surface-border">
                <th className="px-4 py-2 font-normal">Utente</th>
                <th className="px-3 py-2 font-normal">Ruolo</th>
                <th className="px-3 py-2 font-normal">Stato</th>
                <th className="px-3 py-2 font-normal">Piano</th>
                <th className="px-3 py-2 font-normal">Scadenza</th>
                <th className="px-3 py-2 font-normal">Moduli</th>
                <th className="px-3 py-2 font-normal">Ultimo accesso</th>
                <th className="px-3 py-2 font-normal text-right">Misurazioni</th>
                <th className="px-2 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const c = u.commerciale
                const lvl = scadenzaLivello(c?.giorni_alla_scadenza ?? null)
                return (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedId(u.id)}
                    className={`group border-b border-surface-border last:border-0 hover:bg-surface/70 cursor-pointer ${selectedId === u.id ? 'bg-teal-50/40' : ''}`}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5 text-anthracite font-medium">
                        <span className="truncate max-w-[240px]">{u.full_name}</span>
                        {u.is_superadmin && <ShieldCheck size={12} className="text-teal-dark flex-shrink-0" aria-label="Superadmin" />}
                        {u.issue && <IssueBadge issue={u.issue} />}
                      </div>
                      <div className="text-[12px] text-anthracite-lighter truncate max-w-[280px]">
                        {u.email ?? '—'}
                        {u.role === 'client' && u.linked_professional_name && <span> · ↳ {u.linked_professional_name}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-anthracite-light">{u.role === 'professional' ? 'Professionista' : u.role === 'client' ? 'Cliente' : '—'}</td>
                    <td className="px-3 py-2">{c ? <span title={c.stato_motivo ?? undefined}><StatoDot stato={c.stato} /></span> : <span className="text-anthracite-lighter">—</span>}</td>
                    <td className="px-3 py-2">
                      {c ? <PianoPill piano={c.piano} catalogo={catalogo} /> : u.role === 'professional' ? <PianoPill piano={u.plan} catalogo={null} /> : <span className="text-anthracite-lighter">—</span>}
                    </td>
                    <td className="px-3 py-2">{u.role === 'professional' ? <ScadenzaCell c={c} /> : <span className="text-anthracite-lighter">—</span>}</td>
                    <td className="px-3 py-2"><ModuleIcons c={c} catalogo={catalogo} /></td>
                    <td className="px-3 py-2 text-anthracite-lighter whitespace-nowrap">{u.last_sign_in_at ? formatRelative(u.last_sign_in_at) : 'Mai'}</td>
                    <td className="px-3 py-2 text-right text-anthracite tabular-nums">{u.measurements_count}</td>
                    <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-0.5">
                        {u.role === 'client' && (u.issue === 'no_link' || u.issue === 'revoked_link') && (
                          <button type="button" onClick={() => setLinkUser(u)} title="Collega a un professionista" className="w-7 h-7 rounded-md hover:bg-white text-teal-dark inline-flex items-center justify-center">
                            <Link2 size={14} />
                          </button>
                        )}
                        {lvl && <span className={`w-1.5 h-1.5 rounded-full mr-1 ${lvl === '30' ? 'bg-yellow-400' : lvl === '7' ? 'bg-amber-500' : 'bg-red-500'}`} title="Scadenza vicina" />}
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={(e) => setMenu(menu?.user.id === u.id ? null : { user: u, anchor: e.currentTarget })}
                          className="w-7 h-7 rounded-md hover:bg-white text-anthracite-lighter inline-flex items-center justify-center disabled:opacity-40"
                          aria-label="Azioni rapide"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-anthracite-lighter">Nessun utente trovato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Azioni rapide */}
      {menu && (
        <RowMenu anchor={menu.anchor} onClose={() => setMenu(null)}>
          {(() => {
            const u = menu.user
            const c = u.commerciale
            return (
              <>
                <MenuItem icon={PanelRight} onClick={() => { setSelectedId(u.id); setMenu(null) }}>Apri dettaglio</MenuItem>
                {c && (
                  <>
                    <MenuLabel>Account</MenuLabel>
                    {c.stato === 'sospeso' || c.stato === 'bloccato' ? (
                      <MenuItem icon={PlayCircle} disabled={u.is_superadmin} onClick={() => { setPending({ kind: 'status', user: u, stato: 'attivo' }); setMenu(null) }}>Riattiva</MenuItem>
                    ) : (
                      <MenuItem icon={PauseCircle} disabled={u.is_superadmin} onClick={() => { setPending({ kind: 'status', user: u, stato: 'sospeso' }); setMenu(null) }}>Sospendi…</MenuItem>
                    )}
                    {c.stato !== 'bloccato' && (
                      <MenuItem icon={Ban} danger disabled={u.is_superadmin} onClick={() => { setPending({ kind: 'status', user: u, stato: 'bloccato' }); setMenu(null) }}>Blocca…</MenuItem>
                    )}
                    {u.role === 'professional' && c.piano && (
                      <>
                        <MenuLabel>Prolunga {pianoNome(catalogo, c.piano)}</MenuLabel>
                        <div className="px-3 pb-1.5 flex gap-1">
                          {[1, 3, 12].map((m) => (
                            <button key={m} type="button" onClick={() => extend(u, m)} className="flex-1 text-[12px] py-1 rounded-md border border-surface-border hover:bg-surface">
                              +{m === 12 ? '1 anno' : `${m} ${m === 1 ? 'mese' : 'mesi'}`}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {catalogo && (
                      <>
                        <MenuLabel>Moduli</MenuLabel>
                        {catalogo.moduli.map((mod) => {
                          const m = c.moduli.find((x) => x.codice === mod.codice)
                          if (!m) return null
                          const locked = m.fonte === 'stato' || m.fonte === 'superadmin' || m.fonte === 'modulo_disattivato'
                          return (
                            <MenuItem
                              key={mod.codice}
                              icon={moduleIcon(catalogo, mod.codice)}
                              disabled={locked}
                              hint={m.attivo ? (m.fonte === 'eccezione' ? 'eccezione' : 'attivo') : 'spento'}
                              onClick={() => { setPending({ kind: 'module', user: u, m, abilitato: !m.attivo }); setMenu(null) }}
                            >
                              {m.attivo ? 'Disattiva' : 'Attiva'} {mod.nome}
                            </MenuItem>
                          )
                        })}
                      </>
                    )}
                  </>
                )}
              </>
            )
          })()}
        </RowMenu>
      )}

      {pending?.kind === 'status' && (
        <ReasonDialog
          title={pending.stato === 'attivo' ? 'Riattivare l’account?' : pending.stato === 'sospeso' ? 'Sospendere l’account?' : 'Bloccare l’account?'}
          description={`${pending.user.full_name}${pending.stato === 'bloccato' ? ': login negato e sessione chiusa.' : pending.stato === 'sospeso' ? ': login consentito con la schermata "Account sospeso".' : ''}`}
          confirmText={pending.stato === 'attivo' ? 'Riattiva' : pending.stato === 'sospeso' ? 'Sospendi' : 'Blocca'}
          destructive={pending.stato !== 'attivo'}
          onCancel={() => setPending(null)}
          onConfirm={async (motivo) => {
            const p = pending
            const ok = await accountAction(p.user.id, { action: 'status', stato: p.stato, motivo }, showToast, `${p.user.full_name}: ${STATO_LABEL[p.stato].toLowerCase()}`)
            setPending(null)
            if (ok) onChanged()
          }}
        />
      )}
      {pending?.kind === 'module' && catalogo && (
        <ReasonDialog
          title={`${pending.abilitato ? 'Attivare' : 'Disattivare'} ${catalogo.moduli.find((x) => x.codice === pending.m.codice)?.nome} per ${pending.user.full_name}?`}
          description={
            pending.abilitato === pending.m.incluso_nel_piano && pending.m.fonte === 'eccezione'
              ? 'Rimuove l’eccezione: torna a valere il piano.'
              : `Eccezione rispetto al piano ${pianoNome(catalogo, pending.user.commerciale?.piano ?? null)}.`
          }
          confirmText="Conferma"
          withDate={!(pending.abilitato === pending.m.incluso_nel_piano && pending.m.fonte === 'eccezione')}
          dateLabel="L’eccezione vale fino al (facoltativo)"
          onCancel={() => setPending(null)}
          onConfirm={async (motivo, data) => {
            const p = pending
            // Se il valore voluto coincide con il piano e c'era un'eccezione, la si rimuove.
            const abilitato = p.abilitato === p.m.incluso_nel_piano && p.m.fonte === 'eccezione' ? null : p.abilitato
            const ok = await accountAction(p.user.id, { action: 'module', modulo: p.m.codice, abilitato, motivo, scade_il: data }, showToast, 'Modulo aggiornato')
            setPending(null)
            if (ok) onChanged()
          }}
        />
      )}

      {selected && (
        <UserSidePanel user={selected} catalogo={catalogo} onClose={() => setSelectedId(null)} onChanged={onChanged} showToast={showToast} />
      )}
      {linkUser && (
        <ManualLinkModal
          professionals={professionals}
          initialEmail={linkUser.email ?? ''}
          initialProfessionalId={linkUser.linked_professional_id ?? ''}
          onClose={() => setLinkUser(null)}
          onChanged={onChanged}
          showToast={showToast}
        />
      )}
    </div>
  )
}
