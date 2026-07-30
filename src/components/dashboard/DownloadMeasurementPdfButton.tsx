'use client'

import { useState } from 'react'
import { AlertCircle, Download, FileText, Loader2, X } from 'lucide-react'

type Variant = 'button' | 'icon'

type Props = {
  sessionId: string
  clientId: string
  // Usato solo come hint per il nome file mostrato in fallback (il server è autoritativo).
  filenameHint?: string
  variant?: Variant
  className?: string
}

const GENERIC_ERROR =
  'Non è stato possibile generare il PDF. Controlla la connessione e riprova.'

export function DownloadMeasurementPdfButton({
  sessionId,
  clientId,
  filenameHint,
  variant = 'button',
  className = '',
}: Props) {
  const [loading, setLoading] = useState(false)
  // L'alert nativo del browser mostrava il solo messaggio del server ("Accesso
  // negato") fuori dal contesto della pagina: sostituito da un riquadro in-page
  // che spiega cosa è successo e resta finché non lo si chiude.
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/measurement-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clientId }),
      })
      if (!res.ok) {
        let message = GENERIC_ERROR
        try {
          const j = await res.json()
          if (typeof j?.error === 'string' && j.error.trim()) message = j.error
        } catch { /* risposta non JSON: resta il messaggio generico */ }
        throw new Error(message)
      }
      const blob = await res.blob()

      // Estrai filename dal Content-Disposition (lato server è autoritativo).
      let filename = filenameHint ?? 'misurazione.pdf'
      const cd = res.headers.get('Content-Disposition')
      const match = cd?.match(/filename="?([^"]+)"?/i)
      if (match?.[1]) filename = match[1]

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : GENERIC_ERROR)
    } finally {
      setLoading(false)
    }
  }

  const errorBox = error ? (
    <div
      role="alert"
      className={
        variant === 'icon'
          ? 'absolute right-0 top-full mt-2 z-20 w-72 flex items-start gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 shadow-sm text-left'
          : 'mt-2 flex items-start gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-left'
      }
    >
      <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-red-500" />
      <p className="text-[13px] leading-relaxed text-red-800 flex-1">{error}</p>
      <button
        type="button"
        onClick={() => setError(null)}
        aria-label="Chiudi messaggio"
        className="flex-shrink-0 text-red-400 hover:text-red-700 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  ) : null

  if (variant === 'icon') {
    return (
      <div className={`relative inline-flex ${className}`}>
        <button
          type="button"
          onClick={handleDownload}
          disabled={loading}
          aria-label="Scarica PDF misurazione"
          title="Scarica PDF"
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-teal-dark hover:bg-teal-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
        </button>
        {errorBox}
      </div>
    )
  }

  return (
    <div className={`inline-flex flex-col items-stretch max-w-sm ${className}`}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-teal text-teal-dark bg-transparent hover:bg-teal-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Generazione…
          </>
        ) : (
          <>
            <Download size={15} />
            Scarica PDF
          </>
        )}
      </button>
      {errorBox}
    </div>
  )
}
