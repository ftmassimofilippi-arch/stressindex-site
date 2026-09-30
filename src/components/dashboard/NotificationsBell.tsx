'use client'

import { Bell } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { AlertBadge } from './AlertBadge'
import { formatIstante } from '@/lib/format'

// Campanella della TopBar. Prima mostrava solo il contatore e il clic non
// apriva nulla: l'elenco arriva ora da /api/notifiche, caricato alla prima
// apertura.
//
// La lettura NON cancella e non modifica gli alert: il server aggiunge solo una
// data di lettura per utente (tabella `notification_reads`, migration
// sito-030), quindi lo storico resta intero e il contatore mostra le non lette
// di chi guarda. Se la migration non è ancora applicata il server risponde
// `canMarkRead: false` e il pannello nasconde i comandi di lettura.

type Notification = {
  id: string
  source: 'cron' | 'app'
  clientId: string
  clientName: string | null
  title: string
  detail: string
  severity: 'low' | 'medium' | 'high'
  unread: boolean
  readAt: string | null
  createdAt: string
}

export function NotificationsBell({ alertCount = 0 }: { alertCount?: number }) {
  const t = useTranslations('dashboard.topbar')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[] | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [canMarkRead, setCanMarkRead] = useState(false)
  const [marking, setMarking] = useState(false)
  const [count, setCount] = useState(alertCount)
  const boxRef = useRef<HTMLDivElement>(null)

  // Il conteggio arriva dal render server della pagina: se cambia navigando,
  // la campanella si riallinea senza rileggere l'elenco.
  useEffect(() => { setCount(alertCount) }, [alertCount])

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch('/api/notifiche', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { unread: number; canMarkRead: boolean; notifications: Notification[] }
      setItems(data.notifications)
      setCount(data.unread)
      setCanMarkRead(data.canMarkRead)
      setState('idle')
    } catch {
      setState('error')
    }
  }, [])

  // Segna come lette: senza `ids` vale per tutte le non lette. L'elenco resta
  // dov'è, cambiano solo l'evidenza e il contatore.
  const markRead = useCallback(async (ids?: Array<{ source: 'cron' | 'app'; id: string }>) => {
    if (!canMarkRead || marking) return
    setMarking(true)
    try {
      const res = await fetch('/api/notifiche', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(ids ? { ids } : {}),
      })
      if (!res.ok) return
      const data = (await res.json()) as { unread: number }
      setCount(data.unread)
      const segnati = new Set((ids ?? []).map((i) => `${i.source}:${i.id}`))
      setItems((prev) => prev?.map((n) =>
        !ids || segnati.has(`${n.source}:${n.id}`) ? { ...n, unread: false } : n) ?? prev)
    } catch {
      // Silenzioso: la lettura è un di più, non deve interrompere la
      // navigazione verso la scheda del cliente.
    } finally {
      setMarking(false)
    }
  }, [canMarkRead, marking])

  // Chiusura con clic fuori o Esc.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && items === null && state !== 'loading') void load()
  }

  const label = count ? t('notificationsNew', { count }) : t('notifications')
  const hasUnread = (items ?? []).some((n) => n.unread)

  return (
    <div className="relative flex-shrink-0" ref={boxRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative w-10 h-10 rounded-xl hover:bg-surface flex items-center justify-center text-anthracite-lighter hover:text-anthracite transition-colors"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('notifications')}
          className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-auto rounded-xl border border-surface-border bg-white shadow-lg z-30"
        >
          <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-anthracite">{t('notifications')}</span>
            <div className="flex items-center gap-3">
              {canMarkRead && hasUnread && (
                <button
                  type="button"
                  onClick={() => void markRead()}
                  disabled={marking}
                  className="text-xs text-teal-dark hover:underline whitespace-nowrap disabled:opacity-50"
                >
                  {t('notificationsMarkAllRead')}
                </button>
              )}
              <Link
                href="/area-professionisti/clienti"
                onClick={() => setOpen(false)}
                className="text-xs text-teal-dark hover:underline whitespace-nowrap"
              >
                {tc('seeAll')}
              </Link>
            </div>
          </div>

          {state === 'loading' && (
            <div className="px-4 py-6 text-sm text-anthracite-lighter text-center">{t('notificationsLoading')}</div>
          )}
          {state === 'error' && (
            <div className="px-4 py-6 text-sm text-anthracite-lighter text-center">
              {t('notificationsError')}{' '}
              <button type="button" onClick={() => void load()} className="text-teal-dark hover:underline">
                {t('notificationsRetry')}
              </button>
            </div>
          )}
          {state === 'idle' && items !== null && items.length === 0 && (
            <div className="px-4 py-6 text-sm text-anthracite-lighter text-center">{t('notificationsEmpty')}</div>
          )}
          {state === 'idle' && items !== null && items.length > 0 && (
            <ul className="divide-y divide-surface-border">
              {items.map((n) => (
                <li key={`${n.source}:${n.id}`}>
                  <Link
                    href={`/area-professionisti/clienti/${n.clientId}`}
                    onClick={() => {
                      // Aprire la notifica la segna letta. Non si attende la
                      // risposta: la navigazione parte subito.
                      if (n.unread) void markRead([{ source: n.source, id: n.id }])
                      setOpen(false)
                    }}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-surface transition-colors ${n.unread ? 'bg-teal/[0.04]' : ''}`}
                  >
                    <AlertBadge severity={n.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-anthracite truncate flex items-center gap-1.5">
                        {n.unread && (
                          <span
                            aria-label={t('notificationsUnread')}
                            title={t('notificationsUnread')}
                            className="w-1.5 h-1.5 rounded-full bg-teal flex-shrink-0"
                          />
                        )}
                        <span className="truncate">{n.clientName || tc('client')}</span>
                      </div>
                      <div className="text-xs text-anthracite-lighter mt-0.5">
                        {n.title}{n.detail ? ` · ${n.detail}` : ''}
                      </div>
                      <div className="text-[11px] text-anthracite-lighter/80 mt-0.5">
                        {n.readAt
                          ? t('notificationsReadOn', { date: formatIstante(n.readAt, undefined, locale) })
                          : formatIstante(n.createdAt, undefined, locale)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
