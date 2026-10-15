import { cache } from 'react'
import { cookies } from 'next/headers'
import { getMyAccountAccess } from './account-access'
import { SCOPE_COOKIE, risolviScope, type DataScope } from './data-scope'

// Scope dei dati della richiesta corrente (vedi data-scope.ts): cookie
// `sx-scope` più ruolo dell'utente, memorizzato per richiesta. Usa
// next/headers: i componenti client e i moduli puri non lo importano.

export type ScopeContext = {
  scope: DataScope
  isSuperadmin: boolean
  userId: string | null
}

export const getDataScope = cache(async (): Promise<ScopeContext> => {
  const [access, cookieStore] = await Promise.all([getMyAccountAccess(), cookies()])
  const cookie = cookieStore.get(SCOPE_COOKIE)?.value ?? null
  return {
    scope: risolviScope({ isSuperadmin: access.isSuperadmin, cookie }),
    isSuperadmin: access.isSuperadmin,
    userId: access.userId ?? null,
  }
})
