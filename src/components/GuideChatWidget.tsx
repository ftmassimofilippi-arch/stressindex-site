'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Role = 'user' | 'assistant'
type Message = { role: Role; content: string; at: number }

const INITIAL_BOT_MESSAGE =
  "Ciao! Sono l'assistente di Stress Index. Posso aiutarti con la connessione dei sensori, i tipi di test, la lettura dei risultati e qualsiasi altra domanda sull'app. Cosa ti serve?"

const ERROR_MESSAGE =
  "Mi dispiace, c'è stato un problema. Riprova o scrivi a support@stressindex.io"

function formatTime(at: number) {
  const d = new Date(at)
  return d.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1" aria-label="Sta scrivendo">
      <span className="w-1.5 h-1.5 rounded-full bg-anthracite-lighter typing-dot" />
      <span className="w-1.5 h-1.5 rounded-full bg-anthracite-lighter typing-dot" />
      <span className="w-1.5 h-1.5 rounded-full bg-anthracite-lighter typing-dot" />
    </div>
  )
}

export default function GuideChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: INITIAL_BOT_MESSAGE, at: Date.now() },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [pulse, setPulse] = useState(false)

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  // Scroll automatico in fondo a ogni nuovo messaggio o cambio stato sending
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, sending, open])

  // Focus input all'apertura
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Pulse periodico ogni 30s finché l'utente non interagisce, e si ferma
  useEffect(() => {
    if (hasInteracted) return
    const id = window.setInterval(() => {
      setPulse(true)
      window.setTimeout(() => setPulse(false), 1500)
    }, 30_000)
    return () => window.clearInterval(id)
  }, [hasInteracted])

  // Chiusura cliccando fuori (solo desktop ≥ 768px)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (window.innerWidth < 768) return
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Chiusura con Esc
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return

    setHasInteracted(true)

    const userMsg: Message = {
      role: 'user',
      content: trimmed,
      at: Date.now(),
    }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
    setInput('')
    setSending(true)

    try {
      const payloadHistory = nextHistory
        .slice(0, -1)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/guide-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: payloadHistory,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { reply?: string; error?: string }
      const reply = data.reply?.trim()
      if (!reply) throw new Error('empty reply')

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, at: Date.now() },
      ])
    } catch (err) {
      console.error('[GuideChatWidget] send error', err)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: ERROR_MESSAGE, at: Date.now() },
      ])
    } finally {
      setSending(false)
    }
  }, [input, messages, sending])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <>
      <style jsx>{`
        @keyframes guide-pulse {
          0% {
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18),
              0 0 0 0 rgba(79, 163, 154, 0.55);
          }
          70% {
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18),
              0 0 0 18px rgba(79, 163, 154, 0);
          }
          100% {
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18),
              0 0 0 0 rgba(79, 163, 154, 0);
          }
        }
        .pulse {
          animation: guide-pulse 1.4s ease-out;
        }
        @keyframes guide-panel-in {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .panel-in {
          animation: guide-panel-in 200ms ease-out;
        }
        @keyframes typing-blink {
          0%,
          80%,
          100% {
            opacity: 0.25;
          }
          40% {
            opacity: 1;
          }
        }
        :global(.typing-dot) {
          animation: typing-blink 1.2s infinite ease-in-out;
        }
        :global(.typing-dot:nth-child(2)) {
          animation-delay: 0.15s;
        }
        :global(.typing-dot:nth-child(3)) {
          animation-delay: 0.3s;
        }
      `}</style>

      {/* Floating launcher */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setHasInteracted(true)
          setOpen((v) => !v)
        }}
        aria-label={open ? 'Chiudi assistente' : 'Apri assistente'}
        aria-expanded={open}
        className={`fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-teal text-white flex items-center justify-center shadow-elevated hover:bg-teal-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 ${
          pulse && !open ? 'pulse' : ''
        }`}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6L18 18M6 18L18 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Assistente Stress Index"
          aria-modal="false"
          className="panel-in fixed z-[59] bg-white border border-surface-border rounded-2xl shadow-elevated overflow-hidden flex flex-col
                     bottom-24 right-6 w-[400px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-8rem)]
                     md:bottom-24 md:right-6
                     max-md:bottom-0 max-md:right-0 max-md:left-0 max-md:w-full max-md:h-[70vh] max-md:max-h-[70vh] max-md:rounded-b-none"
        >
          {/* Header */}
          <div className="bg-teal text-white px-4 py-3.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 12H6.5L9 6L12 18L15 9L17.5 12H20.5"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold leading-tight truncate">
                  Assistente Stress Index
                </p>
                <p className="text-[12px] text-white/80 leading-tight">
                  In linea
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Chiudi"
              className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6L18 18M6 18L18 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollerRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-surface/40"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-teal text-white rounded-2xl rounded-br-md'
                      : 'bg-[#F0F0F0] text-anthracite rounded-2xl rounded-bl-md'
                  }`}
                >
                  {m.content}
                </div>
                <span className="mt-1 text-[11px] text-anthracite-lighter px-1 tabular-nums">
                  {formatTime(m.at)}
                </span>
              </div>
            ))}
            {sending && (
              <div className="flex flex-col items-start">
                <div className="bg-[#F0F0F0] text-anthracite rounded-2xl rounded-bl-md px-4 py-3">
                  <TypingDots />
                </div>
                <span className="mt-1 text-[11px] text-anthracite-lighter px-1">
                  sta scrivendo…
                </span>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSend()
            }}
            className="border-t border-surface-border bg-white px-3 py-3 flex items-end gap-2 flex-shrink-0"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              rows={1}
              maxLength={2000}
              placeholder="Scrivi la tua domanda…"
              className="flex-1 resize-none bg-surface/60 border border-surface-border rounded-xl px-3 py-2.5 text-[14.5px] text-anthracite placeholder:text-anthracite-lighter focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal disabled:opacity-60 disabled:cursor-not-allowed max-h-32"
              aria-label="Messaggio"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Invia"
              className="w-10 h-10 rounded-xl bg-teal text-white flex-shrink-0 flex items-center justify-center hover:bg-teal-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-teal"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 12L20 4L13 20L11 13L4 12Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  )
}
