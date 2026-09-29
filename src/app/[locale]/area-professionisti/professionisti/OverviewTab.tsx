'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import type { AdminUser } from '@/lib/admin-data'
import type { AccountStato } from '@/lib/admin-commerciale'
import type { Toast } from './adminApi'
import { UserSidePanel } from './UserSidePanel'
import { accountAction, ModuleIcons, PianoPill, ScadenzaCell, StatoDot, type Catalogo } from './commerciale-ui'

// Home del pannello: indicatori in cima (attivi, in prova, in scadenza entro
// 30 giorni, sospesi) e la sezione "In scadenza" con prolungamento rapido.

export type OverviewCounts = { attivi: number; prova: number; scadenza30: number; sospesi: number; bloccati: number }

export function overviewCounts(users: AdminUser[]): OverviewCounts {
  const out: OverviewCounts = { attivi: 0, prova: 0, scadenza30: 0, sospesi: 0, bloccati: 0 }
  for (const u of users) {
    const c = u.commerciale
    if (!c) continue
    if (c.stato === 'sospeso') out.sospesi++
    if (c.stato === 'bloccato') out.bloccati++
    if (u.role !== 'professional') continue
    if (c.stato === 'attivo') out.attivi++
    if (c.stato === 'prova') out.prova++
    if (inScadenza(u)) out.scadenza30++
  }
  return out
}

export function inScadenza(u: AdminUser): boolean {
  const c = u.commerciale
  return !!c && u.role === 'professional' && c.giorni_alla_scadenza !== null && c.giorni_alla_scadenza <= 30 && c.stato !== 'sospeso' && c.stato !== 'bloccato'
}

function Kpi({ label, value, hint, dot, onClick }: { label: string; value: number; hint?: string; dot: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left bg-white border border-surface-border rounded-xl px-4 py-3 hover:bg-surface/60 transition-colors min-w-0">
      <div className="flex items-center gap-1.5 text-[12px] text-anthracite-lighter min-w-0"><span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} /><span className="truncate">{label}</span></div>
      <div className="mt-1 text-2xl font-semibold text-anthracite tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-anthracite-lighter truncate">{hint}</div>}
    </button>
  )
}

export function OverviewTab({
  users,
  catalogo,
  onChanged,
  showToast,
  onOpenUsers,
}: {
  users: AdminUser[]
  catalogo: Catalogo | null
  onChanged: () => void
  showToast: (t: Toast) => void
  onOpenUsers: (filter: { scadenza30?: boolean; stato?: AccountStato }) => void
}) {
  const t = useTranslations('admin')
  const to = useTranslations('admin.overview')
  const tu = useTranslations('admin.users')
  const tErr = useTranslations('errors.api')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const counts = useMemo(() => overviewCounts(users), [users])
  const expiring = useMemo(
    () => users.filter(inScadenza).sort((a, b) => (a.commerciale?.giorni_alla_scadenza ?? 0) - (b.commerciale?.giorni_alla_scadenza ?? 0)),
    [users],
  )
  const selected = users.find((u) => u.id === selectedId) ?? null

  if (!catalogo) {
    return (
      <div className="bg-white border border-surface-border rounded-xl p-6 text-[13px] text-anthracite-lighter">
        {to('migration024')}
      </div>
    )
  }

  async function extend(u: AdminUser, mesi: number) {
    setBusy(`${u.id}:${mesi}`)
    const ok = await accountAction(u.id, { action: 'extend', mesi, motivo: tu('extendReason', { months: mesi }) }, showToast, tu('extended', { name: u.full_name }), tErr, t('commerciale.actionFailed'))
    setBusy(null)
    if (ok) onChanged()
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={to('activeProfessionals')} value={counts.attivi} dot="bg-emerald-500" onClick={() => onOpenUsers({ stato: 'attivo' })} />
        <Kpi label={to('trial')} value={counts.prova} dot="bg-sky-500" onClick={() => onOpenUsers({ stato: 'prova' })} />
        <Kpi label={to('expiring30')} value={counts.scadenza30} dot="bg-amber-400" onClick={() => onOpenUsers({ scadenza30: true })} />
        <Kpi label={to('suspended')} value={counts.sospesi} hint={counts.bloccati ? to('blockedHint', { count: counts.bloccati }) : undefined} dot="bg-amber-600" onClick={() => onOpenUsers({ stato: 'sospeso' })} />
      </div>

      <section>
        <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
          <h2 className="text-[15px] font-semibold text-anthracite">{to('expiringTitle')}</h2>
          <span className="text-[12px] text-anthracite-lighter">{to('expiringSubtitle')}</span>
        </div>
        <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
          {expiring.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-anthracite-lighter">{to('expiringEmpty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[800px]">
                <thead>
                  <tr className="text-left text-[12px] text-anthracite-lighter border-b border-surface-border">
                    <th className="px-4 py-2 font-normal">{to('thProfessional')}</th>
                    <th className="px-3 py-2 font-normal">{to('thStatus')}</th>
                    <th className="px-3 py-2 font-normal">{to('thPlan')}</th>
                    <th className="px-3 py-2 font-normal">{to('thExpiry')}</th>
                    <th className="px-3 py-2 font-normal">{to('thModules')}</th>
                    <th className="px-3 py-2 font-normal text-right">{to('thExtend')}</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.map((u) => (
                    <tr key={u.id} onClick={() => setSelectedId(u.id)} className="border-b border-surface-border last:border-0 hover:bg-surface/70 cursor-pointer">
                      <td className="px-4 py-2 max-w-[260px]">
                        <div className="text-anthracite font-medium truncate">{u.full_name}</div>
                        <div className="text-[12px] text-anthracite-lighter truncate">{u.email ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2">{u.commerciale && <StatoDot stato={u.commerciale.stato} />}</td>
                      <td className="px-3 py-2"><PianoPill piano={u.commerciale?.piano ?? null} catalogo={catalogo} /></td>
                      <td className="px-3 py-2"><ScadenzaCell c={u.commerciale} /></td>
                      <td className="px-3 py-2"><ModuleIcons c={u.commerciale} catalogo={catalogo} /></td>
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex gap-1">
                          {[1, 3, 12].map((m) => (
                            <button key={m} type="button" disabled={!!busy} onClick={() => extend(u, m)} className="text-[12px] px-2 py-1 rounded-md border border-surface-border hover:bg-surface disabled:opacity-40 inline-flex items-center gap-1 whitespace-nowrap">
                              {busy === `${u.id}:${m}` && <Loader2 size={11} className="animate-spin" />}{tu('extendMonths', { months: m })}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {selected && <UserSidePanel user={selected} catalogo={catalogo} onClose={() => setSelectedId(null)} onChanged={onChanged} showToast={showToast} />}
    </div>
  )
}
