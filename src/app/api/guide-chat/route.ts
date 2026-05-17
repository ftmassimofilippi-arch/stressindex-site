import { NextResponse } from 'next/server'
import { GUIDE_KNOWLEDGE_BASE } from '@/lib/guide-knowledge-base'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 1000
const MAX_HISTORY = 10
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000

const ALLOWED_ORIGINS = [
  'https://stressindex.io',
  'https://www.stressindex.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

type ChatRole = 'user' | 'assistant'
type ChatMessage = { role: ChatRole; content: string }

const SYSTEM_PROMPT = `Sei l'assistente virtuale di Stress Index, il software professionale italiano per l'analisi HRV.
Il tuo compito è rispondere alle domande degli utenti basandoti ESCLUSIVAMENTE sulle informazioni contenute nelle guide qui sotto. Se non trovi la risposta nelle guide, dillo chiaramente e suggerisci di contattare support@stressindex.io.

Rispondi in italiano, dai del tu, sii professionale ma accessibile. Risposte brevi e dirette, massimo 3-4 paragrafi. Non usare il trattino lungo per dividere le frasi, usa la virgola.

Non inventare informazioni. Non dare consigli medici. Se ti chiedono cose non relative a Stress Index o all'HRV, rispondi gentilmente che puoi aiutare solo su argomenti relativi a Stress Index.

CONTENUTO GUIDE:

${GUIDE_KNOWLEDGE_BASE}`

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

function rateLimitExceeded(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  bucket.count += 1
  if (bucket.count > RATE_LIMIT_MAX) return true
  return false
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) {
    // Same-origin browser fetches may omit Origin in some edge cases.
    // Fall back to referer matching.
    const referer = req.headers.get('referer')
    if (!referer) return false
    return ALLOWED_ORIGINS.some((o) => referer.startsWith(o))
  }
  return ALLOWED_ORIGINS.includes(origin)
}

function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  const cleaned: ChatMessage[] = []
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      'role' in item &&
      'content' in item &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.content === 'string' &&
      item.content.trim().length > 0
    ) {
      cleaned.push({
        role: item.role,
        content: item.content.slice(0, 4000),
      })
    }
  }
  return cleaned.slice(-MAX_HISTORY)
}

export async function POST(req: Request) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ip = getClientIp(req)
  if (rateLimitExceeded(ip)) {
    return NextResponse.json(
      { error: 'Troppe richieste, riprova fra un minuto.' },
      { status: 429 },
    )
  }

  let body: { message?: unknown; history?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido.' }, { status: 400 })
  }

  const message =
    typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return NextResponse.json({ error: 'Messaggio vuoto.' }, { status: 400 })
  }
  if (message.length > 2000) {
    return NextResponse.json(
      { error: 'Messaggio troppo lungo (massimo 2000 caratteri).' },
      { status: 400 },
    )
  }

  const history = sanitizeHistory(body.history)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[guide-chat] ANTHROPIC_API_KEY non configurata')
    return NextResponse.json(
      { error: 'Servizio non configurato.' },
      { status: 500 },
    )
  }

  const messages: ChatMessage[] = [
    ...history,
    { role: 'user', content: message },
  ]

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
      }),
    })

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '')
      console.error(
        '[guide-chat] Anthropic API error',
        upstream.status,
        errText.slice(0, 500),
      )
      return NextResponse.json(
        { error: 'Errore del servizio AI.' },
        { status: 502 },
      )
    }

    const data = (await upstream.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    const reply =
      data.content
        ?.filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text!)
        .join('\n')
        .trim() ?? ''

    if (!reply) {
      return NextResponse.json(
        { error: 'Risposta vuota dal servizio AI.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[guide-chat] fetch error', err)
    return NextResponse.json(
      { error: 'Errore di rete verso il servizio AI.' },
      { status: 502 },
    )
  }
}
