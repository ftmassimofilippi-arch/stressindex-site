import { NextResponse } from 'next/server'
import { createClient } from './supabase-server'
import type { User } from '@supabase/supabase-js'

// Verifica server-side che il chiamante sia autenticato E superadmin.
// Da usare all'inizio di OGNI route privilegiata in /api/admin/*:
//
//   const guard = await requireSuperadmin()
//   if (guard.error) return guard.error
//   const { user } = guard
//
// La verifica usa il client con la sessione dell'utente (cookie) + la colonna
// profiles.is_superadmin: nessuna fiducia al client.
export async function requireSuperadmin(): Promise<
  { error: NextResponse; user: null } | { error: null; user: User }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }), user: null }
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .maybeSingle()
  if (error || !(data as { is_superadmin?: boolean } | null)?.is_superadmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }), user: null }
  }
  return { error: null, user }
}
