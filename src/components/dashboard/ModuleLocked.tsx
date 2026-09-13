import { Lock } from 'lucide-react'

// Modulo non attivo per l'account (has_module_access, migration 024).
export function ModuleLocked({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-xl mx-auto card p-10 text-center mt-10">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-light text-teal-dark flex items-center justify-center mb-5">
        <Lock size={26} />
      </div>
      <h1 className="font-serif text-2xl text-anthracite">{title}</h1>
      <p className="mt-2 text-sm text-anthracite-lighter">{description}</p>
      <p className="mt-4 text-sm text-anthracite-lighter">
        Per attivarlo scrivi a{' '}
        <a href="mailto:support@stressindex.io" className="text-teal-dark font-medium hover:underline">support@stressindex.io</a>
      </p>
    </div>
  )
}
