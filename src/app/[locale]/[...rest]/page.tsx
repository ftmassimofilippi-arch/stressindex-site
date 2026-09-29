import { notFound } from 'next/navigation'

// Percorsi sconosciuti dentro un segmento di lingua valido: 404 localizzato
// (not-found.tsx del segmento [locale]).
export default function CatchAllPage() {
  notFound()
}
