import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* Logo placeholder — sostituire con SVG reale */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-2xl font-semibold text-anthracite tracking-tight">
              Stress Index
            </span>
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold text-anthracite mb-4 tracking-tight">
          Analisi HRV Professionale
        </h1>
        
        <p className="text-anthracite-lighter text-lg mb-8 leading-relaxed">
          Il primo software italiano per l'analisi della variabilità cardiaca. 
          Per medici, fisioterapisti, osteopati e coach.
        </p>

        <Link href="/registrazione" className="btn-primary text-lg px-8 py-4">
          Prova gratuita 90 giorni
        </Link>

        <p className="mt-4 text-sm text-anthracite-lighter">
          Nessuna carta di credito richiesta
        </p>
      </div>
    </div>
  )
}
