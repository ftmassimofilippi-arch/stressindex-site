import type { NextResponse } from 'next/server'
import { NextResponse as Res } from 'next/server'
import { apiError } from './api-error'
import { filterMonitoringByModules, getMyAccountAccess } from './account-access'
import { createClient } from './supabase-server'
import { getMonitoringSession } from './monitoring-data'
import type { MonitoringSession } from './monitoring-types'
import type { ProfessionalProfile } from './types'

// Autorizzazione condivisa delle route /api/monitoring/[id]/*: utente
// loggato + riga leggibile (RLS o ponte service_role del professionista
// loggato). Restituisce anche il profilo del professionista TITOLARE della
// riga (professionista_id), non dell'osservatore: i PDF restano intestati
// allo studio giusto anche nella vista superadmin.
//
// Gli errori sono codici stabili (`apiError`): il client li traduce con
// `errors.api.<codice>`.

export type MonitoringAccess =
  | { error: NextResponse; session: null; professional: null; userId: null }
  | { error: null; session: MonitoringSession; professional: ProfessionalProfile | null; userId: string }

export async function loadMonitoringForRoute(sessionId: string): Promise<MonitoringAccess> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: apiError('session_expired', 401), session: null, professional: null, userId: null }
  }
  const session = await getMonitoringSession(sessionId, user.id)
  if (!session) {
    return { error: apiError('monitoring_not_found', 404), session: null, professional: null, userId: null }
  }
  const modules = await getMyAccountAccess()
  if (filterMonitoringByModules([session], modules).length === 0) {
    return { error: apiError('monitoring_module_not_active', 403), session: null, professional: null, userId: null }
  }
  const ownerId = session.professionista_id ?? user.id
  const { data: professional } = await supabase
    .from('professional_profiles')
    .select('*')
    .eq('id', ownerId)
    .maybeSingle<ProfessionalProfile>()
  return { error: null, session, professional: professional ?? null, userId: user.id }
}

export function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

export function csvResponse(csv: string, filename: string): NextResponse {
  return new Res('﻿' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
