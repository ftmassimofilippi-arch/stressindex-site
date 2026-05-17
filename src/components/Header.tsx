import Link from 'next/link'

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-surface-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-lg font-semibold text-anthracite tracking-tight">
            Stress Index
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/guide"
            className="hidden sm:inline-block text-sm font-medium text-anthracite hover:text-teal transition-colors px-3 py-2"
          >
            Guide
          </Link>
          <Link
            href="/area-professionisti/login"
            className="text-sm font-medium text-anthracite hover:text-teal transition-colors px-3 py-2"
          >
            Area Professionisti
          </Link>
          <Link
            href="/registrazione"
            className="btn-primary text-sm px-5 py-2.5"
          >
            Prova gratuita
          </Link>
        </nav>
      </div>
    </header>
  )
}
