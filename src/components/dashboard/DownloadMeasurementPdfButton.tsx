'use client'

import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'

type Variant = 'button' | 'icon'

type Props = {
  sessionId: string
  clientId: string
  // Usato solo come hint per il nome file mostrato in fallback (il server è autoritativo).
  filenameHint?: string
  variant?: Variant
  className?: string
}

export function DownloadMeasurementPdfButton({
  sessionId,
  clientId,
  filenameHint,
  variant = 'button',
  className = '',
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/measurement-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clientId }),
      })
      if (!res.ok) {
        let message = 'Errore generazione PDF'
        try {
          const j = await res.json()
          if (j?.error) message = j.error
        } catch { /* ignore */ }
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
      const msg = err instanceof Error ? err.message : 'Errore generazione PDF'
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        aria-label="Scarica PDF misurazione"
        title="Scarica PDF"
        className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-teal-dark hover:bg-teal-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-teal text-teal-dark bg-transparent hover:bg-teal-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
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
  )
}
