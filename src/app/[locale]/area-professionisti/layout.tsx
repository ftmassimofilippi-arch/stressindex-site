import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Area Professionisti', template: '%s | Area Professionisti Stress Index' },
  description: 'Dashboard professionale Stress Index — area riservata',
  robots: { index: false, follow: false },
}

export default function AreaProfessionistiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
