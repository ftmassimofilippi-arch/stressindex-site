import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { logAdminAction } from '@/lib/admin-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/clients/merge — unione anagrafiche doppione.
// Body: { keep_id: string, merge_ids: string[], dry_run?: boolean }
//
// Delega TUTTO alla RPC admin_merge_clients (migration 017), che:
//  • scopre le tabelle referenzianti in modo dinamico (FK da pg_constraint +
//    riferimenti soft noti senza FK: measurement_analytics, links)
//  • con dry_run=true ritorna solo i conteggi per tabella (anteprima)
//  • con dry_run=false sposta tutti i riferimenti e cancella le righe unite
//    in UNA transazione (la funzione stessa): o tutto o niente.
export async function POST(req: NextRequest) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const body = await req.json().catch(() => ({}))

  const keepId = typeof body.keep_id === 'string' ? body.keep_id : ''
  const mergeIds = Array.isArray(body.merge_ids) ? body.merge_ids.filter((x: unknown): x is string => typeof x === 'string') : []
  const dryRun = body.dry_run !== false // default: anteprima
  if (!keepId || mergeIds.length === 0) return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  if (mergeIds.includes(keepId)) return NextResponse.json({ error: 'keep_in_merge_list' }, { status: 400 })

  const admin = createAdminClient()

  // Esecuzione: unione "morbida" per scheda (migration 019). La scheda unita
  // resta in tabella con merged_into_client_id (nascosta ad app e sito dalla
  // policy clients_hide_merged) e ogni unione è tracciata in clients_merge_log:
  // stessa funzione usata dallo script di riparazione. Se la 019 non è
  // applicata si ricade su admin_merge_clients (017, cancellazione fisica).
  if (!dryRun) {
    const results: unknown[] = []
    let softAvailable = true
    for (const mergeId of mergeIds) {
      const { data: soft, error: softErr } = await admin.rpc('collegamenti_merge_card', {
        p_keep_id: keepId,
        p_merge_id: mergeId,
        p_reason: 'admin:merge',
        p_performed_by: guard.user.id,
      })
      if (softErr && (softErr.code === 'PGRST202' || softErr.code === '42883')) {
        softAvailable = false
        break
      }
      if (softErr) return NextResponse.json({ error: softErr.message, merged_so_far: results }, { status: 500 })
      results.push(soft)
    }
    if (softAvailable) {
      await logAdminAction(admin, guard.user, {
        action: 'merge_clients',
        target_type: 'client',
        target_id: keepId,
        details: { merged_ids: mergeIds, result: results, mode: 'soft' },
      })
      return NextResponse.json({ ok: true, result: results, mode: 'soft' })
    }
  }

  // p_performed_by*: la RPC gira come service_role (auth.uid() null), quindi
  // l'attore per l'audit delle eliminazioni da conflitto va passato esplicitamente.
  const { data, error } = await admin.rpc('admin_merge_clients', {
    p_keep_id: keepId,
    p_merge_ids: mergeIds,
    p_dry_run: dryRun,
    p_performed_by: guard.user.id,
    p_performed_by_email: guard.user.email ?? null,
  })

  if (error) {
    // RPC assente → migration 017 non ancora applicata su Supabase.
    if (error.code === 'PGRST202' || error.code === '42883') {
      return NextResponse.json({ error: 'migration_required', message: 'Applica la migration 017 su Supabase per abilitare l’unione doppioni.' }, { status: 501 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!dryRun) {
    await logAdminAction(admin, guard.user, {
      action: 'merge_clients',
      target_type: 'client',
      target_id: keepId,
      details: { merged_ids: mergeIds, result: data },
    })
  }

  return NextResponse.json({ ok: true, result: data })
}
