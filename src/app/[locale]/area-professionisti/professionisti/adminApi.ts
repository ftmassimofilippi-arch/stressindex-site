// Helper condivisi fra i componenti client del pannello Super Admin.
import type { Tr } from '@/i18n/types'

export type Toast = { kind: 'ok' | 'err'; text: string } | null

/** Traduttore del namespace `errors.api` (da `useTranslations('errors.api')`). */
export type ErrTr = Tr & { has: (key: string) => boolean }

export async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

// Messaggio leggibile da una risposta API: il codice (`code`/`error`) viene
// tradotto se ha una chiave in errors.api, con i campi piatti del payload come
// valori di interpolazione ({detail}, {who}, {migration}…); altrimenti si
// mostra `message` o il testo così com'è (es. errori di Supabase).
export function errorText(json: Record<string, unknown> | null | undefined, t: ErrTr, fallback?: string): string {
  const code = typeof json?.code === 'string' ? json.code : typeof json?.error === 'string' ? json.error : ''
  if (code && /^[a-z0-9_]+$/.test(code) && t.has(code)) {
    const values: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(json ?? {})) if (typeof v === 'string' || typeof v === 'number') values[k] = v
    return t(code, values)
  }
  if (typeof json?.message === 'string' && json.message) return json.message
  return code || fallback || t('generic')
}
