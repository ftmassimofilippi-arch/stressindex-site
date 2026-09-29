'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  CalendarPlus, Link2, MoreHorizontal, PanelRight, PauseCircle, PlayCircle, Search, ShieldCheck, Ban, AlertTriangle, Clock,
} from 'lucide-react'
import { formatRelative } from '@/lib/format'
import type { AdminUser } from '@/lib/admin-data'
import type { AccountModulo, AccountStato } from '@/lib/admin-commerciale'
import { type AdminIssue, adminIssueHint, adminIssueLabel, ADMIN_ISSUE_ORDER, ADMIN_ISSUE_TONE } from '@/lib/admin-issues'
import type { Toast } from './adminApi'
import { ManualLinkModal } from './ManualLinkModal'
import { UserSidePanel } from './UserSidePanel'
import {
  accountAction, MenuItem, MenuLabel, ModuleIcons, moduleIcon, moduloNome, PianoPill, pianoNome, ReasonDialog, RowMenu, ScadenzaCell, scadenzaLivello,
  STATI, statoLabel, StatoDot, type Catalogo,
} from './commerciale-ui'

type ProfessionalOption = { id: string; name: string; email: string | null }

function IssueBadge({ issue }: { issue: AdminIssue }) {
  const t = useTranslations('admin')
  const tone = ADMIN_ISSUE_TONE[issue]
  const cls = tone === 'red' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'
  const Icon = issue === 'pending_link' ? Clock : AlertTriangle
  return (
    <span title={adminIssueHint(issue, t)} className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap ${cls}`}>
      <Icon size={10} /> {adminIssueLabel(issue, t)}
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
  const t = useTranslations('admin')
  const tu = useTranslations('admin.users')
  const tc = useTranslations('common')
  const tErr = useTranslations('errors.api')
  const locale = useLocale()
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
    const ok = await accountAction(u.id, { action: 'extend', mesi, motivo: tu('extendReason', { months: mesi }) }, showToast, tu('extended', { name: u.full_name }), tErr, t('commerciale.actionFailed'))
    setBusyId(null)
    if (ok) onChanged()
  }

  const roleLabel = (role: string | null) => (role === 'professional' || role === 'client' ? t(`role.${role}`) : '—')
  const selectCls = 'px-2.5 py-1.5 text-[13px] bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 text-anthracite max-w-full'

  return (
    <div className="space-y-3">
      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-anthracite-lighter" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tu('search')}
            className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-white border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)} className={selectCls}>
          <option value="all">{tu('roleAll')}</option>
          <option value="professional">{tu('roleProfessionals')}</option>
          <option value="client">{tu('roleClients')}</option>
        </select>
        {hasCommerciale && (
          <>
            <select value={statoFilter} onChange={(e) => setStatoFilter(e.target.value as typeof statoFilter)} className={selectCls}>
              <option value="all">{tu('statusAll')}</option>
              {STATI.map((s) => <option key={s} value={s}>{statoLabel(s, t)}</option>)}
            </select>
            <select value={pianoFilter} onChange={(e) => setPianoFilter(e.target.value)} className={selectCls}>
              <option value="all">{tu('planAll')}</option>
              {catalogo.piani.map((p) => <option key={p.codice} value={p.codice}>{pianoNome(catalogo, p.codice, t)}</option>)}
            </select>
            <select value={moduloFilter} onChange={(e) => setModuloFilter(e.target.value)} className={selectCls}>
              <option value="all">{tu('moduleAll')}</option>
              {catalogo.moduli.map((m) => <option key={m.codice} value={m.codice}>{tu('withModule', { module: moduloNome(catalogo, m.codice, t) })}</option>)}
            </select>
            <label className={`inline-flex items-center gap-1.5 text-[13px] px-2.5 py-1.5 rounded-lg border cursor-pointer ${scadenza30 ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-surface-border bg-white text-anthracite'}`}>
              <input type="checkbox" className="sr-only" checked={scadenza30} onChange={(e) => setScadenza30(e.target.checked)} />
              <CalendarPlus size={13} className="flex-shrink-0" /> {tu('expiring30')}
            </label>
          </>
        )}
        {!hasCommerciale && (
          <select value={pianoFilter} onChange={(e) => setPianoFilter(e.target.value)} className={selectCls}>
            <option value="all">{tu('planAll')}</option>
            <option value="pro">{t('plans.pro')}</option>
            <option value="base">{t('plans.base')}</option>
          </select>
        )}
        <select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value as typeof issueFilter)} className={selectCls}>
          <option value="all">{tu('issueAll')}</option>
          <option value="any">{tu('issueAny')}</option>
          {ADMIN_ISSUE_ORDER.map((k) => <option key={k} value={k}>{tu('issueOption', { label: adminIssueLabel(k, t), count: issueCounts.get(k) ?? 0 })}</option>)}
        </select>
        <span className="text-[12px] text-anthracite-lighter ml-auto whitespace-nowrap">{tu('countOf', { shown: filtered.length, total: users.length })}</span>
      </div>

      {!hasCommerciale && (
        <div className="text-[13px] px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-100">
          {tu('migration024')}
        </div>
      )}

      {/* Tabella */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[1040px]">
            <thead>
              <tr className="text-left text-[12px] text-anthracite-lighter border-b border-surface-border">
                <th className="px-4 py-2 font-normal">{tu('thUser')}</th>
                <th className="px-3 py-2 font-normal">{tu('thRole')}</th>
                <th className="px-3 py-2 font-normal">{tu('thStatus')}</th>
                <th className="px-3 py-2 font-normal">{tu('thPlan')}</th>
                <th className="px-3 py-2 font-normal">{tu('thExpiry')}</th>
                <th className="px-3 py-2 font-normal">{tu('thModules')}</th>
                <th className="px-3 py-2 font-normal">{tu('thLastSignIn')}</th>
                <th className="px-3 py-2 font-normal text-right">{tu('thMeasurements')}</th>
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
                      <div className="flex items-center gap-1.5 text-anthracite font-medium min-w-0">
                        <span className="truncate max-w-[240px]">{u.full_name}</span>
                        {u.is_superadmin && <ShieldCheck size={12} className="text-teal-dark flex-shrink-0" aria-label={tu('superadmin')} />}
                        {u.issue && <IssueBadge issue={u.issue} />}
                      </div>
                      <div className="text-[12px] text-anthracite-lighter truncate max-w-[280px]">
                        {u.email ?? '—'}
                        {u.role === 'client' && u.linked_professional_name && <span> · ↳ {u.linked_professional_name}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-anthracite-light whitespace-nowrap">{roleLabel(u.role)}</td>
                    <td className="px-3 py-2">{c ? <span title={c.stato_motivo ?? undefined}><StatoDot stato={c.stato} /></span> : <span className="text-anthracite-lighter">—</span>}</td>
                    <td className="px-3 py-2">
                      {c ? <PianoPill piano={c.piano} catalogo={catalogo} /> : u.role === 'professional' ? <PianoPill piano={u.plan} catalogo={null} /> : <span className="text-anthracite-lighter">—</span>}
                    </td>
                    <td className="px-3 py-2">{u.role === 'professional' ? <ScadenzaCell c={c} /> : <span className="text-anthracite-lighter">—</span>}</td>
                    <td className="px-3 py-2"><ModuleIcons c={c} catalogo={catalogo} /></td>
                    <td className="px-3 py-2 text-anthracite-lighter whitespace-nowrap">{u.last_sign_in_at ? formatRelative(u.last_sign_in_at, locale) : t('never')}</td>
                    <td className="px-3 py-2 text-right text-anthracite tabular-nums">{u.measurements_count}</td>
                    <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-0.5">
                        {u.role === 'client' && (u.issue === 'no_link' || u.issue === 'revoked_link') && (
                          <button type="button" onClick={() => setLinkUser(u)} title={tu('linkHint')} className="w-7 h-7 rounded-md hover:bg-white text-teal-dark inline-flex items-center justify-center">
                            <Link2 size={14} />
                          </button>
                        )}
                        {lvl && <span className={`w-1.5 h-1.5 rounded-full mr-1 ${lvl === '30' ? 'bg-yellow-400' : lvl === '7' ? 'bg-amber-500' : 'bg-red-500'}`} title={tu('expiryNear')} />}
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={(e) => setMenu(menu?.user.id === u.id ? null : { user: u, anchor: e.currentTarget })}
                          className="w-7 h-7 rounded-md hover:bg-white text-anthracite-lighter inline-flex items-center justify-center disabled:opacity-40"
                          aria-label={tu('quickActions')}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-anthracite-lighter">{tu('empty')}</td></tr>
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
                <MenuItem icon={PanelRight} onClick={() => { setSelectedId(u.id); setMenu(null) }}>{tu('openDetail')}</MenuItem>
                {c && (
                  <>
                    <MenuLabel>{tu('menuAccount')}</MenuLabel>
                    {c.stato === 'sospeso' || c.stato === 'bloccato' ? (
                      <MenuItem icon={PlayCircle} disabled={u.is_superadmin} onClick={() => { setPending({ kind: 'status', user: u, stato: 'attivo' }); setMenu(null) }}>{tu('reactivate')}</MenuItem>
                    ) : (
                      <MenuItem icon={PauseCircle} disabled={u.is_superadmin} onClick={() => { setPending({ kind: 'status', user: u, stato: 'sospeso' }); setMenu(null) }}>{tu('suspend')}</MenuItem>
                    )}
                    {c.stato !== 'bloccato' && (
                      <MenuItem icon={Ban} danger disabled={u.is_superadmin} onClick={() => { setPending({ kind: 'status', user: u, stato: 'bloccato' }); setMenu(null) }}>{tu('block')}</MenuItem>
                    )}
                    {u.role === 'professional' && c.piano && (
                      <>
                        <MenuLabel>{tu('extendPlan', { plan: pianoNome(catalogo, c.piano, t) })}</MenuLabel>
                        <div className="px-3 pb-1.5 flex gap-1">
                          {[1, 3, 12].map((m) => (
                            <button key={m} type="button" onClick={() => extend(u, m)} className="flex-1 min-w-0 truncate text-[12px] py-1 rounded-md border border-surface-border hover:bg-surface">
                              {tu('extendMonths', { months: m })}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {catalogo && (
                      <>
                        <MenuLabel>{tu('menuModules')}</MenuLabel>
                        {catalogo.moduli.map((mod) => {
                          const m = c.moduli.find((x) => x.codice === mod.codice)
                          if (!m) return null
                          const locked = m.fonte === 'stato' || m.fonte === 'superadmin' || m.fonte === 'modulo_disattivato'
                          const nome = moduloNome(catalogo, mod.codice, t)
                          return (
                            <MenuItem
                              key={mod.codice}
                              icon={moduleIcon(catalogo, mod.codice)}
                              disabled={locked}
                              hint={m.attivo ? (m.fonte === 'eccezione' ? tu('hintException') : tu('hintActive')) : tu('hintOff')}
                              onClick={() => { setPending({ kind: 'module', user: u, m, abilitato: !m.attivo }); setMenu(null) }}
                            >
                              {m.attivo ? tu('disableModule', { module: nome }) : tu('enableModule', { module: nome })}
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
          title={pending.stato === 'attivo' ? tu('reactivateTitle') : pending.stato === 'sospeso' ? tu('suspendTitle') : tu('blockTitle')}
          description={pending.stato === 'bloccato' ? tu('blockDescription', { name: pending.user.full_name }) : pending.stato === 'sospeso' ? tu('suspendDescription', { name: pending.user.full_name }) : pending.user.full_name}
          confirmText={pending.stato === 'attivo' ? tu('confirmReactivate') : pending.stato === 'sospeso' ? tu('confirmSuspend') : tu('confirmBlock')}
          destructive={pending.stato !== 'attivo'}
          onCancel={() => setPending(null)}
          onConfirm={async (motivo) => {
            const p = pending
            const ok = await accountAction(p.user.id, { action: 'status', stato: p.stato, motivo }, showToast, tu('statusChanged', { name: p.user.full_name, status: statoLabel(p.stato, t).toLowerCase() }), tErr, t('commerciale.actionFailed'))
            setPending(null)
            if (ok) onChanged()
          }}
        />
      )}
      {pending?.kind === 'module' && catalogo && (
        <ReasonDialog
          title={tu(pending.abilitato ? 'moduleEnableTitle' : 'moduleDisableTitle', { module: moduloNome(catalogo, pending.m.codice, t), name: pending.user.full_name })}
          description={
            pending.abilitato === pending.m.incluso_nel_piano && pending.m.fonte === 'eccezione'
              ? tu('moduleRemoveException')
              : tu('moduleException', { plan: pianoNome(catalogo, pending.user.commerciale?.piano ?? null, t) })
          }
          confirmText={tc('confirm')}
          withDate={!(pending.abilitato === pending.m.incluso_nel_piano && pending.m.fonte === 'eccezione')}
          dateLabel={tu('exceptionUntil')}
          onCancel={() => setPending(null)}
          onConfirm={async (motivo, data) => {
            const p = pending
            // Se il valore voluto coincide con il piano e c'era un'eccezione, la si rimuove.
            const abilitato = p.abilitato === p.m.incluso_nel_piano && p.m.fonte === 'eccezione' ? null : p.abilitato
            const ok = await accountAction(p.user.id, { action: 'module', modulo: p.m.codice, abilitato, motivo, scade_il: data }, showToast, tu('moduleUpdated'), tErr, t('commerciale.actionFailed'))
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
