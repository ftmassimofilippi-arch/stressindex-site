import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { createPrintToken, printSecretConfigured, type PrintKind } from '@/lib/print-token'
import { renderPagePdf, siteOrigin } from '@/lib/pdf-render'
import { withLocale, type Locale } from '@/i18n/routing'

// =============================================================================
// Pezzi comuni delle route /api/pdf/*: apre la pagina di stampa con Chrome
// headless (con i cookie della richiesta, quindi con la sessione del
// professionista) e restituisce il PDF come download.
// =============================================================================

export async function pdfFromPrintPage(opts: {
  req: Request
  locale: Locale
  /** Percorso della pagina di stampa SENZA prefisso di lingua, es. `/stampa/misurazione/abc`. */
  path: string
  query?: Record<string, string | undefined>
  token: { kind: PrintKind; id: string; userId: string }
  filename: string
  extraHeaders?: Record<string, string>
}): Promise<NextResponse> {
  const { req, locale, path, query, token, filename, extraHeaders } = opts
  if (!printSecretConfigured()) {
    // Nessun fallback in produzione: senza segreto non si firmano token.
    console.error('[pdf] PDF_TOKEN_SECRET mancante: impossibile firmare il token della pagina di stampa. Impostare la variabile su Vercel.')
    return apiError('pdf_secret_missing', 500)
  }
  const url = new URL(withLocale(path, locale), siteOrigin(req))
  for (const [k, v] of Object.entries(query ?? {})) if (v) url.searchParams.set(k, v)
  url.searchParams.set('token', createPrintToken(token))

  const started = Date.now()
  let pdf: Buffer
  try {
    pdf = await renderPagePdf({ url: url.toString(), cookieHeader: req.headers.get('cookie') })
  } catch (err) {
    console.error('[pdf] render error', { path, err })
    return apiError('pdf_render_failed', 500)
  }
  const elapsed = Date.now() - started
  console.log(`[pdf] ${path} ${pdf.length} byte in ${elapsed} ms`)

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdf.length.toString(),
      'Cache-Control': 'no-store',
      'X-Pdf-Render-Ms': String(elapsed),
      ...(extraHeaders ?? {}),
    },
  })
}

/** Inoltra la richiesta al generatore legacy (react-pdf) quando PDF_LEGACY=true. */
export async function proxyLegacy(req: Request, path: string, init: RequestInit): Promise<NextResponse> {
  const res = await fetch(new URL(path, siteOrigin(req)), {
    ...init,
    headers: { ...(init.headers as Record<string, string>), cookie: req.headers.get('cookie') ?? '' },
    cache: 'no-store',
  })
  const body = Buffer.from(await res.arrayBuffer())
  const headers = new Headers()
  for (const h of ['content-type', 'content-disposition', 'x-measurement-count']) {
    const v = res.headers.get(h)
    if (v) headers.set(h, v)
  }
  headers.set('cache-control', 'no-store')
  return new NextResponse(new Uint8Array(body), { status: res.status, headers })
}

export function dateStamp(d: Date | null | undefined): string {
  const x = d && !Number.isNaN(d.getTime()) ? d : new Date()
  return x.toISOString().slice(0, 10)
}
