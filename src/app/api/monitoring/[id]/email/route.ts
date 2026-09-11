import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { loadMonitoringForRoute } from '@/lib/monitoring-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/monitoring/[id]/email — "Invia al cliente".
// Riusa l'infrastruttura messaggi del sito (tabella `messages`, come
// MessageComposer): il messaggio viene archiviato in cronologia con il link
// al PDF cliente. La consegna email vera passa dalla Edge Function
// `send-message` (Resend) ancora da realizzare: finché non c'è, il cliente
// NON riceve una email e la riga resta delivered=false. Nessuna simulazione
// di invio.

const Body = z.object({ subject: z.string().min(1).max(200), content: z.string().min(1).max(5000) })

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await loadMonitoringForRoute(params.id)
  if (access.error) return access.error
  const { session, userId } = access
  if (!session.client_id) return NextResponse.json({ error: 'Questo monitoraggio non è collegato a una scheda cliente.' }, { status: 400 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Oggetto e messaggio sono obbligatori.' }, { status: 400 })

  const origin = new URL(req.url).origin
  const pdfLink = `${origin}/api/monitoring/${session.id}/pdf?variant=client`
  const content = `${parsed.data.content.trim()}\n\nReport PDF: ${pdfLink}`

  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    professional_id: session.professionista_id ?? userId,
    client_id: session.client_id,
    subject: parsed.data.subject.trim(),
    content,
    channel: 'email',
    delivered: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ok: true,
    message: 'Messaggio archiviato nella cronologia del cliente con il link al PDF. La consegna email arriverà con la Edge Function dedicata: per ora il cliente non riceve una email.',
  })
}
