import nodemailer, { type Transporter } from 'nodemailer'

// =============================================================================
// Invio email dal sito (SMTP proprio)
// =============================================================================
//
// L'SMTP configurato in Supabase → Authentication manda SOLO le email di
// autenticazione (invito, reset password) e non è utilizzabile da qui. Per le
// email nostre — l'avviso al cliente quando il professionista interviene sul suo
// accesso — serve un SMTP proprio, con le stesse credenziali usate dalle Edge
// Function delle notifiche (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
// SMTP_FROM), così le credenziali di allyou.srl restano uno solo set.
//
// BEST EFFORT, per scelta: se SMTP non è configurato o l'invio fallisce, la
// chiamata NON solleva. L'azione del professionista (impostare una password,
// mandare un reset) è già andata a buon fine e non deve essere annullata perché
// un avviso di cortesia non è partito. L'esito torna al chiamante, che lo
// scrive in professional_access_log: così si vede quali avvisi sono saltati.

export type EsitoEmail = { sent: true } | { sent: false; reason: string }

let cached: Transporter | null = null

export function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM)
}

function transport(): Transporter {
  if (cached) return cached
  const port = Number(process.env.SMTP_PORT ?? '587')
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 = TLS diretto. Ogni altra porta parte in chiaro e sale con STARTTLS.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  return cached
}

export async function sendMail(opts: {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}): Promise<EsitoEmail> {
  if (!smtpConfigured()) {
    return { sent: false, reason: 'SMTP non configurato (SMTP_HOST/USER/PASS/FROM)' }
  }
  try {
    await transport().sendMail({
      from: process.env.SMTP_FROM,
      to: opts.to,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    })
    return { sent: true }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[mailer] invio fallito', reason)
    return { sent: false, reason }
  }
}

// ── Scheletro grafico, coerente con le email di notifica ─────────────────────

const C = { teal: '#4FA39A', tealDark: '#2E746C', ink: '#2F343A', inkLight: '#4A5058', muted: '#6B7280', border: '#E2E6EA', surface: '#F6F7F8' }
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Email semplice: titolo, paragrafi, eventuale nota in fondo. */
export function emailLayout(titolo: string, paragrafi: string[], nota?: string): string {
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(titolo)}</title></head>
<body style="margin:0;padding:0;background:${C.surface};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:${FONT};">
        <tr><td style="padding:0 4px 16px;">
          <span style="font-size:15px;font-weight:700;color:${C.tealDark};letter-spacing:.02em;">Stress Index</span>
        </td></tr>
        <tr><td style="background:#FFFFFF;border:1px solid ${C.border};border-radius:16px;padding:24px 20px;">
          <h1 style="margin:0 0 14px;font-size:18px;line-height:1.4;color:${C.ink};">${escapeHtml(titolo)}</h1>
          ${paragrafi.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${C.inkLight};">${p}</p>`).join('')}
        </td></tr>
        ${nota ? `<tr><td style="padding:16px 4px 0;"><p style="margin:0;font-size:12px;line-height:1.6;color:${C.muted};">${escapeHtml(nota)}</p></td></tr>` : ''}
      </table>
    </td></tr>
  </table>
</body></html>`
}
