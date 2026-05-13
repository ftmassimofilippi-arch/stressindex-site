'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZE = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-anthracite/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className={`relative bg-white rounded-2xl shadow-elevated w-full ${SIZE[size]} max-h-[90vh] overflow-hidden flex flex-col`}>
        {(title || description) && (
          <div className="px-6 py-5 border-b border-surface-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                {title && <h2 className="text-lg font-serif text-anthracite">{title}</h2>}
                {description && <p className="text-sm text-anthracite-lighter mt-1">{description}</p>}
              </div>
              <button type="button" aria-label="Chiudi" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-surface-border bg-surface/50">{footer}</div>}
      </div>
    </div>
  )
}
