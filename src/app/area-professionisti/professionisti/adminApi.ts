// Helper condivisi fra i componenti client del pannello Super Admin.

export type Toast = { kind: 'ok' | 'err'; text: string } | null

export async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}
