'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, HeartPulse, Link2, Loader2, Merge, RefreshCw, ShieldCheck, Wrench } from 'lucide-react'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import type { AdminClientRow } from '@/lib/admin-data'
import { api, type Toast } from './adminApi'
import { MergeClientsModal } from './MergeClientsModal'

// ============================================================================
// Tab "Salute collegamenti" del pannello Super Admin.
// Legge la view v_collegamenti_salute (migration 020) via /api/admin/collegamenti
// e propone, per ogni riga, l'azione di riparazione: "Ripara" (con conferma)
// chiama la RPC indicata dalla view; "Unisci" apre il modale di unione schede.
// Il badge in alto viene dall'ultimo alert aperto scritto dal job settimanale.
// ============================================================================

export type SaluteRow = {
  tipo_problema: string
  gravita: 'alta' | 'media' | 'bassa'
  client_id: string | null
  client_user_id: string | null
  professional_id: string | null
  link_id: string | null
  email: string | null
  nome: string | null
  professionista: string | null
  dettaglio: string | null
  fix_proposto: string | null
  fix_auto: boolean
  fix_rpc: string | null
  fix_args: Record<string, unknown>
}

type SaluteAlert = { id: number; total: number; details: Record<string, number>; created_at: string } | null

export const SALUTE_LABELS: Record<string, string> = {
  scheda_duplicata: 'Schede duplicate (stessa email, stesso professionista)',
  ponte_mancante: 'Ponte mancante (scheda senza account, profilo con la stessa email)',
  ponte_ruolo_errato: 'Ponte verso un profilo non cliente',
  link_senza_scheda: 'Collegamento attivo senza scheda',
  link_profilo_inesistente: 'Collegamento attivo con profilo cancellato',
  pending_vecchio: 'Richieste pendenti da oltre 30 giorni',
  link_duplicato: 'Collegamenti doppi per la stessa coppia',
  sessioni_remote_senza_link: 'Misurazioni remote invisibili (utente senza collegamento)',
  profilo_client_orfano: 'Profili cliente senza alcun collegamento',
  scheda_con_ponte_senza_link: 'Scheda con account ma senza collegamento',
  analytics_disallineato: 'Analytics attribuite a una scheda diversa dalla sessione',
  monitoraggio_incoerente: 'Monitoraggi con cliente/utente incoerenti',
}

const TONE: Record<SaluteRow['gravita'], string> = {
  alta: 'bg-red-50 text-red-700 border-red-200',
  media: 'bg-amber-50 text-amber-700 border-amber-200',
  bassa: 'bg-surface text-anthracite-lighter border-surface-border',
}

type Pending = { row: SaluteRow; title: string; description: string; run: () => Promise<void> } | null

export function SaluteTab({ clients, onChanged, showToast }: { clients: AdminClientRow[]; onChanged: () => void; showToast: (t: Toast) => void }) {
  const [rows, setRows] = useState<SaluteRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [alert, setAlert] = useState<SaluteAlert>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [mergeOpen, setMergeOpen] = useState<SaluteRow | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { ok, json } = await api('GET', '/api/admin/collegamenti')
    if (json?.migration_required) {
      setMigrationRequired(true)
      setLoading(false)
      return
    }
    if (!ok) setError(json?.error ?? 'Errore caricamento')
    setRows(json?.rows ?? [])
    setCounts(json?.counts ?? {})
    setAlert(json?.alert ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => (filter ? rows.filter((r) => r.tipo_problema === filter) : rows), [rows, filter])
  const types = useMemo(() => Object.keys(counts).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)), [counts])

  async function runAction(row: SaluteRow, body: Record<string, unknown>, okText: string) {
    const key = `${row.tipo_problema}:${row.client_id ?? ''}:${row.client_user_id ?? ''}:${row.link_id ?? ''}`
    setBusy(key)
    const { ok, json } = await api('POST', '/api/admin/collegamenti', body)
    setBusy(null)
    if (!ok) {
      showToast({ kind: 'err', text: json?.message ?? json?.error ?? 'Riparazione fallita' })
      return
    }
    showToast({ kind: 'ok', text: okText })
    await load()
    onChanged()
  }

  function askRepair(row: SaluteRow) {
    const who = [row.nome, row.email].filter(Boolean).join(' · ') || row.client_id || row.client_user_id || ''
    if (row.fix_rpc === 'ensure_client_bridge') {
      setPending({
        row,
        title: 'Scrivere il ponte scheda ↔ account?',
        description: `${who}: la scheda verrà agganciata al profilo con la stessa email (una scheda per professionista, eventuali doppioni uniti).`,
        run: () => runAction(row, { action: 'bridge', email: row.email }, 'Ponte scritto'),
      })
    } else if (row.fix_rpc === 'link_client_to_professional') {
      setPending({
        row,
        title: 'Creare il collegamento?',
        description: `${who} ↔ ${row.professionista ?? row.professional_id}: scheda agganciata o creata, link attivo, eventuali link doppi revocati.`,
        run: () => runAction(row, { action: 'link', client_user_id: row.client_user_id, professional_id: row.professional_id }, 'Collegamento creato'),
      })
    } else if (row.fix_rpc === 'revoke_link') {
      setPending({
        row,
        title: 'Revocare il collegamento?',
        description: `${who}: il profilo del cliente non esiste più, il link ${row.link_id ?? ''} verrà messo a revoked.`,
        run: () => runAction(row, { action: 'revoke_link', link_id: row.link_id }, 'Collegamento revocato'),
      })
    } else if (row.fix_rpc === 'realign_analytics') {
      setPending({
        row,
        title: 'Riallineare le analytics?',
        description: 'measurement_analytics.client_id verrà riportato alla scheda della sessione, per tutte le righe disallineate.',
        run: () => runAction(row, { action: 'realign_analytics' }, 'Analytics riallineate'),
      })
    }
  }

  // Candidato professionista per le sessioni remote invisibili: la view mette
  // in fix_args i professionisti che hanno una scheda con la stessa email.
  function remoteCandidates(row: SaluteRow): Array<{ professional_id: string; professionista: string; client_id: string }> {
    const c = row.fix_args?.candidati
    return Array.isArray(c) ? (c as Array<{ professional_id: string; professionista: string; client_id: string }>) : []
  }

  if (migrationRequired) {
    return (
      <div className="card p-6 text-sm text-anthracite-lighter flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-anthracite">View non disponibile</p>
          <p className="mt-1">Applica le migration 019 e 020 su Supabase (v_collegamenti_salute) per attivare questa tab.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-anthracite inline-flex items-center gap-2">
            <HeartPulse size={18} className="text-teal" /> Salute collegamenti
          </h2>
          {alert ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200">
              <AlertTriangle size={13} /> Controllo settimanale: {alert.total} problemi il {new Date(alert.created_at).toLocaleDateString('it-IT')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200">
              <ShieldCheck size={13} /> Nessun alert aperto
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runAction({ tipo_problema: 'check' } as SaluteRow, { action: 'check' }, 'Controllo eseguito')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-surface-border hover:bg-surface text-anthracite-lighter"
          >
            <Wrench size={15} /> Esegui controllo ora
          </button>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-surface-border hover:bg-surface text-anthracite-lighter disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Aggiorna
          </button>
        </div>
      </div>

      {error && (
        <div className="callout-amber text-sm">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Conteggi per tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`card p-3 text-left text-sm flex items-center justify-between ${filter === null ? 'ring-2 ring-teal' : ''}`}
        >
          <span className="text-anthracite">Tutti i problemi</span>
          <span className="font-semibold text-anthracite">{rows.length}</span>
        </button>
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`card p-3 text-left text-sm flex items-center justify-between gap-2 ${filter === t ? 'ring-2 ring-teal' : ''}`}
          >
            <span className="text-anthracite">{SALUTE_LABELS[t] ?? t}</span>
            <span className="font-semibold text-anthracite">{counts[t]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-12 flex items-center justify-center text-anthracite-lighter">
          <Loader2 className="animate-spin mr-2" size={18} /> Caricamento…
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center text-sm text-anthracite-lighter inline-flex items-center justify-center gap-2 w-full">
          <CheckCircle2 size={16} className="text-green-500" /> Nessun problema rilevato
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-anthracite-lighter border-b border-surface-border">
                <th className="px-3 py-2">Gravità</th>
                <th className="px-3 py-2">Problema</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Professionista</th>
                <th className="px-3 py-2">Dettaglio</th>
                <th className="px-3 py-2">Azione</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const key = `${r.tipo_problema}:${r.client_id ?? ''}:${r.client_user_id ?? ''}:${r.link_id ?? ''}`
                const isBusy = busy === key
                const candidates = r.tipo_problema === 'sessioni_remote_senza_link' ? remoteCandidates(r) : []
                return (
                  <tr key={`${key}:${i}`} className="border-b border-surface-border/60 align-top">
                    <td className="px-3 py-2">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-md border ${TONE[r.gravita]}`}>{r.gravita}</span>
                    </td>
                    <td className="px-3 py-2 text-anthracite">{SALUTE_LABELS[r.tipo_problema] ?? r.tipo_problema}</td>
                    <td className="px-3 py-2">
                      <div className="text-anthracite">{r.nome || '—'}</div>
                      <div className="text-xs text-anthracite-lighter">{r.email ?? ''}</div>
                      {r.client_id && <div className="text-[11px] text-anthracite-lighter font-mono">{r.client_id}</div>}
                    </td>
                    <td className="px-3 py-2 text-anthracite">{r.professionista ?? (r.professional_id ? r.professional_id.slice(0, 8) : '—')}</td>
                    <td className="px-3 py-2">
                      <div className="text-anthracite-lighter">{r.dettaglio}</div>
                      <div className="text-xs text-anthracite mt-0.5">{r.fix_proposto}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.fix_rpc === 'admin_merge' ? (
                        <button type="button" onClick={() => setMergeOpen(r)} className="btn-secondary text-xs inline-flex items-center gap-1">
                          <Merge size={13} /> Unisci
                        </button>
                      ) : r.fix_auto && r.fix_rpc ? (
                        <button type="button" disabled={isBusy} onClick={() => askRepair(r)} className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-50">
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Wrench size={13} />} Ripara
                        </button>
                      ) : candidates.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {candidates.map((c) => (
                            <button
                              key={c.professional_id}
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                setPending({
                                  row: r,
                                  title: 'Collegare il cliente a questo professionista?',
                                  description: `${r.nome ?? ''} <${r.email ?? ''}> ↔ ${c.professionista}: le sue misurazioni remote diventeranno visibili a questo studio. Verifica che sia davvero il suo professionista.`,
                                  run: () => runAction(r, { action: 'link', client_user_id: r.client_user_id, professional_id: c.professional_id }, 'Collegamento creato'),
                                })
                              }
                              className="btn-secondary text-xs inline-flex items-center gap-1"
                            >
                              <Link2 size={13} /> Collega a {c.professionista}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-anthracite-lighter">a mano</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.title ?? ''}
        description={pending?.description}
        confirmText="Ripara"
        onConfirm={async () => {
          const p = pending
          setPending(null)
          if (p) await p.run()
        }}
      />

      {mergeOpen && (
        <MergeClientsModal
          clients={clients.filter((c) => {
            const ids = mergeOpen.fix_args?.client_ids
            return Array.isArray(ids) ? (ids as string[]).includes(c.id) : c.professionista_id === mergeOpen.professional_id
          })}
          onClose={() => setMergeOpen(null)}
          onChanged={() => {
            load()
            onChanged()
          }}
          showToast={showToast}
        />
      )}
    </div>
  )
}
