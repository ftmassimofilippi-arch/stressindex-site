'use client'

import { useState } from 'react'
import { Modal } from './Modal'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  requireTypedConfirmation?: string // se valorizzato, l'utente deve digitarlo
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmText = 'Conferma', cancelText = 'Annulla',
  destructive = false, requireTypedConfirmation,
}: Props) {
  const [typed, setTyped] = useState('')
  const [loading, setLoading] = useState(false)
  const canConfirm = !requireTypedConfirmation || typed === requireTypedConfirmation

  async function handle() {
    if (!canConfirm) return
    setLoading(true)
    try { await onConfirm() } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">{cancelText}</button>
          <button
            type="button"
            disabled={!canConfirm || loading}
            onClick={handle}
            className={`text-sm px-5 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 ${destructive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-teal hover:bg-teal-dark text-white'}`}
          >
            {loading ? 'Attendere…' : confirmText}
          </button>
        </div>
      }
    >
      {requireTypedConfirmation && (
        <div>
          <label className="input-label">Digita <b>{requireTypedConfirmation}</b> per confermare</label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="input-field"
          />
        </div>
      )}
    </Modal>
  )
}
