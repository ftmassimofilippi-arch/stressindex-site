import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import type { ProfessionalProfile } from '@/lib/types'
import { PrintReady } from './PrintReady'

type Props = {
  /** Riga destra dell'header: cliente. */
  clientLine: string
  /** Riga destra dell'header, sotto: data (e tipo). */
  dateLine: string
  professional: ProfessionalProfile | null
  children: ReactNode
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-teal flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-anthracite">Stress Index</span>
    </div>
  )
}

/** Riga del professionista nel footer: solo i campi compilati. */
export function professionalLine(p: ProfessionalProfile | null): string[] {
  if (!p) return []
  const name = [p.titolo, p.nome, p.cognome].filter((x) => x && String(x).trim()).join(' ')
  const role = [p.professione, p.specializzazione].filter((x) => x && String(x).trim()).join(' · ')
  return [name, role, p.nome_studio, p.indirizzo, p.telefono, p.sito_web]
    .map((x) => (x ? String(x).trim() : ''))
    .filter(Boolean)
}

// Cornice A4: header (logo + cliente + data) e footer (professionista +
// disclaimer breve) ripetuti su ogni pagina tramite thead/tfoot.
export async function PrintShell({ clientLine, dateLine, professional, children }: Props) {
  const t = await getTranslations('print')
  const pro = professionalLine(professional)

  return (
    <div className="print-page font-sans text-anthracite">
      <PrintReady />
      <table className="print-frame">
        <thead>
          <tr>
            <td>
              <header className="flex items-start justify-between gap-4 pb-3 mb-5 border-b border-surface-border">
                <Logo />
                <div className="text-right min-w-0">
                  <div className="text-[13px] font-semibold text-anthracite truncate">{clientLine}</div>
                  <div className="text-[11px] text-anthracite-lighter">{dateLine}</div>
                </div>
              </header>
            </td>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td>
              <footer className="pt-3 mt-6 border-t border-surface-border text-[8.5px] leading-snug text-anthracite-lighter">
                {pro.length > 0 && <div className="text-anthracite-light">{pro.join(' · ')}</div>}
                <div className="mt-0.5">{t('footerDisclaimer')}</div>
              </footer>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td>{children}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** Titolo di sezione nello stile della dashboard. */
export function PrintSection({ title, subtitle, children, className = '', avoid = false }: { title: string; subtitle?: string; children: ReactNode; className?: string; avoid?: boolean }) {
  // `avoid`: sezione corta che deve restare intera (titolo + contenuto) sulla stessa pagina.
  return (
    <section className={`print-section mt-6 ${avoid ? 'print-avoid' : ''} ${className}`}>
      <h2 className="font-serif text-[17px] text-anthracite leading-tight">{title}</h2>
      {subtitle && <p className="text-[10px] text-anthracite-lighter mt-0.5 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  )
}

/** Coppia etichetta/valore della copertina. */
export function PrintKv({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wide text-anthracite-lighter">{label}</div>
      <div className="text-[11.5px] font-medium text-anthracite break-words">{value}</div>
    </div>
  )
}
