'use client'

import { Search, Loader2, User, ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

type ClientHit = { kind: 'client'; id: string; nome: string | null; cognome: string | null; email: string | null }
type ProfHit = { kind: 'professional'; id: string; nome: string | null; cognome: string | null; email: string | null }
type Hit = ClientHit | ProfHit

function label(h: Hit): string {
  const full = `${h.nome ?? ''} ${h.cognome ?? ''}`.trim()
  return full || h.email || (h.kind === 'professional' ? 'Professionista' : 'Cliente')
}

// Ricerca globale nella TopBar: digita per cercare clienti (e, per il superadmin,
// professionisti). I risultati sono filtrati dalle RLS lato Supabase, quindi un
// professionista normale vede solo i propri clienti. Click → naviga alla scheda.
export function GlobalSearch({ className = '' }: { className?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  // Chiudi il dropdown al click fuori.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Query con debounce 250ms.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setLoading(false)
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      const supabase = createClient()
      const like = `%${q}%`
      const [clientsRes, profsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, nome, cognome, email')
          .or(`nome.ilike.${like},cognome.ilike.${like},email.ilike.${like}`)
          .limit(8),
        supabase
          .from('profiles')
          .select('id, nome, cognome, email')
          .eq('role', 'professional')
          .or(`nome.ilike.${like},cognome.ilike.${like},email.ilike.${like}`)
          .limit(8),
      ])
      const clientHits: Hit[] = (clientsRes.data ?? []).map((c) => ({
        kind: 'client',
        id: c.id as string,
        nome: c.nome as string | null,
        cognome: c.cognome as string | null,
        email: c.email as string | null,
      }))
      const profHits: Hit[] = (profsRes.data ?? []).map((p) => ({
        kind: 'professional',
        id: p.id as string,
        nome: p.nome as string | null,
        cognome: p.cognome as string | null,
        email: p.email as string | null,
      }))
      setHits([...profHits, ...clientHits])
      setActive(0)
      setLoading(false)
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  function go(h: Hit) {
    setOpen(false)
    setQuery('')
    setHits([])
    if (h.kind === 'client') router.push(`/area-professionisti/clienti/${h.id}`)
    else router.push(`/area-professionisti/clienti?professionista=${h.id}`)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      if (hits[active]) go(hits[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && query.trim().length >= 2

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-anthracite-lighter pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Cerca clienti, professionisti…"
        className="w-full pl-9 pr-9 py-2 text-sm bg-surface border border-surface-border rounded-xl placeholder:text-anthracite-lighter focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal focus:bg-white transition-colors"
      />
      {query && (
        <button
          type="button"
          aria-label="Pulisci ricerca"
          onClick={() => {
            setQuery('')
            setHits([])
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-anthracite-lighter hover:text-anthracite"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
        </button>
      )}

      {showDropdown && (
        <div className="absolute right-0 left-0 top-full mt-2 bg-white border border-surface-border rounded-xl shadow-elevated overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
          {loading && hits.length === 0 ? (
            <div className="px-4 py-6 text-sm text-anthracite-lighter text-center">Ricerca in corso…</div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-6 text-sm text-anthracite-lighter text-center">Nessun risultato per “{query.trim()}”</div>
          ) : (
            <ul className="py-1.5">
              {hits.map((h, i) => (
                <li key={`${h.kind}-${h.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      i === active ? 'bg-surface' : 'hover:bg-surface'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        h.kind === 'professional' ? 'bg-teal-light text-teal-dark' : 'bg-surface text-anthracite-lighter'
                      }`}
                    >
                      {h.kind === 'professional' ? <ShieldCheck size={15} /> : <User size={15} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-anthracite truncate">{label(h)}</span>
                      <span className="block text-xs text-anthracite-lighter truncate">
                        {h.kind === 'professional' ? 'Professionista' : 'Cliente'}
                        {h.email ? ` · ${h.email}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
