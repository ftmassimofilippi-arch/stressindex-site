import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from './supabase-server'
import { reportDataError } from './data-error'
import { age } from './format'
import { normProfileFromClient, rangesFromNormRows, type ClientNorms } from './hrv-norms'

export type { ClientNorms }

// Range di riferimento per età, sesso e attività del cliente, letti da
// `hrv_norms` (policy `hrv_norms_lettura_loggati`). Solo i range: nessuno
// score si ricalcola qui. Se la tabella non risponde l'errore va a Sentry e
// la pagina resta sui range generici: mai una pagina rotta per un di più.

type ClienteNorme = {
  sesso?: string | null
  data_nascita?: string | null
  atleta?: boolean | null
  livello_attivita?: string | null
}

export async function loadClientNorms(client: ClienteNorme, supabase?: SupabaseClient): Promise<ClientNorms> {
  const p = normProfileFromClient(client, age(client.data_nascita))
  if (!p.ok) return { kind: 'missing', missing: p.missing, sexOther: p.sexOther }
  try {
    const db = supabase ?? (await createClient())
    const { data, error } = await db
      .from('hrv_norms')
      .select('metric, p25, p75')
      .eq('sex', p.profile.sex)
      .eq('age_group', p.profile.ageGroup)
      .eq('fitness', p.profile.fitness)
    if (error) {
      reportDataError('loadClientNorms', error)
      return { kind: 'unavailable' }
    }
    const ranges = rangesFromNormRows((data ?? []) as Array<{ metric: string; p25: unknown; p75: unknown }>)
    if (Object.keys(ranges).length === 0) return { kind: 'unavailable' }
    return { kind: 'personal', profile: p.profile, ranges }
  } catch (e) {
    reportDataError('loadClientNorms', e instanceof Error ? e : null)
    return { kind: 'unavailable' }
  }
}
