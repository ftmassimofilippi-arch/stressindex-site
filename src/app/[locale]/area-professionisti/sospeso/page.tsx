import { Link } from '@/i18n/navigation'
import { PauseCircle } from 'lucide-react'
import { SignOutButton } from './SignOutButton'

export const metadata = { title: 'Account sospeso' }
export const dynamic = 'force-dynamic'

// Mostrata dal middleware (rewrite) a ogni pagina dell'area professionisti
// quando lo stato dell'account è "sospeso" (migration 024). Nessun dato di
// clienti o misurazioni: solo il messaggio, il contatto e l'uscita.
export default function AccountSospesoPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md bg-white border border-surface-border rounded-2xl p-8 text-center shadow-card">
        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5">
          <PauseCircle size={24} />
        </div>
        <h1 className="font-serif text-3xl text-anthracite">Account sospeso</h1>
        <p className="mt-3 text-sm text-anthracite-light">
          Il tuo account è temporaneamente sospeso: clienti e misurazioni non sono accessibili finché non viene riattivato.
          I tuoi dati sono al sicuro e tornano disponibili con la riattivazione.
        </p>
        <p className="mt-4 text-sm text-anthracite-light">
          Contatta il supporto:{' '}
          <a href="mailto:support@stressindex.io" className="text-teal-dark font-medium hover:underline">support@stressindex.io</a>
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link href="/supporto" className="btn-secondary text-sm">Pagina supporto</Link>
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
