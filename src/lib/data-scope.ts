// =============================================================================
// Scope dei dati nell'area professionisti: "i miei dati" o "tutta la piattaforma"
// =============================================================================
//
// Un'unica regola per tutte le pagine (audit QA 14/10/2026, punto C3):
//   • un professionista vede SEMPRE e solo il proprio perimetro (perimetro.ts),
//     qualunque cosa dica il cookie;
//   • un superadmin può passare a "tutta la piattaforma" con l'interruttore in
//     alto; la scelta vive nel cookie `sx-scope` e di default è "i miei dati".
// In modalità globale le pagine mostrano CONTEGGI di piattaforma, non righe:
// il cliente dà il consenso al proprio professionista, non al Super Admin
// (superadmin-scope.ts, decisione confermata il 15/10/2026). Nomi, email e
// misurazioni dei clienti altrui non escono da qui.
//
// Modulo puro (niente next/headers): la lettura del cookie e del ruolo sta in
// data-scope-server.ts; i test in data-scope.test.ts.

export type DataScope = 'mine' | 'all'

export const SCOPE_COOKIE = 'sx-scope'

export function isDataScope(v: unknown): v is DataScope {
  return v === 'mine' || v === 'all'
}

/**
 * Scope effettivo: il cookie conta solo per un superadmin; per chiunque altro
 * (o con un cookie non valido) vale "mine".
 */
export function risolviScope(input: { isSuperadmin: boolean; cookie: string | null | undefined }): DataScope {
  if (!input.isSuperadmin) return 'mine'
  return input.cookie === 'all' ? 'all' : 'mine'
}

/** Un professionista normale non può mai chiedere la vista globale. */
export function puoCambiareScope(isSuperadmin: boolean): boolean {
  return isSuperadmin
}
