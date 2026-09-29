import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// Link, router e pathname consapevoli della lingua: `Link href="/registrazione"`
// diventa /en/registrazione quando la lingua attiva è l'inglese, e `usePathname`
// restituisce il percorso SENZA prefisso (utile per stati attivi e breadcrumb).
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
