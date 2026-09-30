import type { Metadata } from 'next'
import '@/styles/print.css'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// Layout delle pagine di stampa: nessuna sidebar, header o selettore lingua.
// Il root layout ([locale]/layout.tsx) fornisce font (self-hosted da
// next/font) e provider next-intl.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-white min-h-screen">{children}</div>
}
