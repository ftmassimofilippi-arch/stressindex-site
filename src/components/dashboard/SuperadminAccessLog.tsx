'use client'

import { useEffect } from 'react'

// Audit log lato browser: registra in console quando un superadmin accede ai
// dati di un professionista. Placeholder in attesa di una tabella audit_log su
// Supabase (vedi TASK). Non renderizza nulla.
export function SuperadminAccessLog({
  adminId,
  professionistaId,
  professionalName,
}: {
  adminId: string
  professionistaId: string
  professionalName?: string
}) {
  useEffect(() => {
    console.log('[SUPERADMIN ACCESS]', {
      timestamp: new Date().toISOString(),
      admin_id: adminId,
      professionista_id: professionistaId,
      professional_name: professionalName ?? null,
    })
  }, [adminId, professionistaId, professionalName])

  return null
}
