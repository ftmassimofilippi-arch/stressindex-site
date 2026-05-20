import Link from 'next/link'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-teal flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-sm text-anthracite-lighter">
              © {currentYear} Stress Index · Tutti i diritti riservati
            </span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-anthracite-lighter">
            <Link href="/funzionalita" className="hover:text-teal transition-colors">
              Funzionalità
            </Link>
            <Link href="/sport" className="hover:text-teal transition-colors">
              Sport
            </Link>
            <Link href="/guide" className="hover:text-teal transition-colors">
              Guide
            </Link>
            <Link href="/privacy" className="hover:text-teal transition-colors">
              Privacy
            </Link>
            <Link href="/termini" className="hover:text-teal transition-colors">
              Termini
            </Link>
            <Link href="/contatti" className="hover:text-teal transition-colors">
              Contatti
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
