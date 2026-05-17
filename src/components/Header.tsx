import Link from 'next/link'

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-lg font-semibold text-anthracite tracking-tight">
            Stress Index
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/guide"
            className="hidden sm:inline-block text-sm font-medium text-anthracite-light hover:text-teal transition-colors px-3 py-2 rounded-md"
          >
            Guide
          </Link>
          <Link
            href="/area-professionisti/login"
            className="text-sm font-medium text-anthracite-light hover:text-teal transition-colors px-3 py-2 rounded-md"
          >
            Area Professionisti
          </Link>
          <Link
            href="/registrazione"
            className="ml-2 inline-flex items-center justify-center px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-dark transition-colors"
          >
            Prova gratuita
          </Link>
        </nav>
      </div>
    </header>
  )
}
