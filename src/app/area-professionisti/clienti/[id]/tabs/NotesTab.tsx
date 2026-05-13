'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit3 } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { createClient } from '@/lib/supabase-browser'
import { formatDate } from '@/lib/format'
import type { Client, ClientNote } from '@/lib/types'
import { useRouter } from 'next/navigation'

const TAG_PRESETS = ['valutazione iniziale', 'post-trattamento', 'follow-up', 'osservazione']

export function NotesTab({ client, initialNotes }: { client: Client; initialNotes: ClientNote[] }) {
  const router = useRouter()
  const [notes, setNotes] = useState<ClientNote[]>(initialNotes)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [loading, setLoading] = useState(false)

  function startNew() {
    setEditingId(null); setContent(''); setTags([]); setOpen(true)
  }
  function startEdit(n: ClientNote) {
    setEditingId(n.id); setContent(n.content); setTags(n.tags ?? []); setOpen(true)
  }

  function toggleTag(t: string) {
    setTags((arr) => arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t])
  }

  async function save() {
    if (!content.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    if (editingId) {
      const { data, error } = await supabase
        .from('client_notes')
        .update({ content, tags, updated_at: new Date().toISOString() })
        .eq('id', editingId)
        .select()
        .maybeSingle()
      if (!error && data) setNotes((n) => n.map((x) => x.id === editingId ? (data as ClientNote) : x))
    } else {
      const { data, error } = await supabase
        .from('client_notes')
        .insert({ professional_id: user.id, client_id: client.id, content, tags })
        .select()
        .maybeSingle()
      if (!error && data) setNotes((n) => [data as ClientNote, ...n])
    }
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Eliminare questa nota?')) return
    const supabase = createClient()
    await supabase.from('client_notes').delete().eq('id', id)
    setNotes((n) => n.filter((x) => x.id !== id))
  }

  const filtered = notes.filter((n) => {
    if (search && !n.content.toLowerCase().includes(search.toLowerCase())) return false
    if (tagFilter && !(n.tags ?? []).includes(tagFilter)) return false
    return true
  })

  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags ?? []))).sort()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca nelle note…"
            className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-white border border-surface-border rounded-xl"
          />
          {allTags.length > 0 && (
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="px-3 py-2 text-sm bg-white border border-surface-border rounded-xl">
              <option value="">Tutti i tag</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
        <button type="button" onClick={startNew} className="btn-primary text-sm inline-flex items-center gap-1.5">
          <Plus size={15} /> Nuova nota
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={Edit3} title="Nessuna nota" description="Inizia ad annotare osservazioni cliniche, valutazioni e follow-up." action={{ label: 'Nuova nota', onClick: startNew }} />
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((n) => (
            <li key={n.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-anthracite-lighter">{formatDate(n.created_at, 'd MMMM yyyy')}</span>
                  {(n.tags ?? []).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[11px] bg-teal-light text-teal-dark">{t}</span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => startEdit(n)} className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center" aria-label="Modifica">
                    <Edit3 size={14} />
                  </button>
                  <button type="button" onClick={() => remove(n.id)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center" aria-label="Elimina">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-anthracite whitespace-pre-wrap leading-relaxed">{n.content}</p>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Modifica nota' : 'Nuova nota'}
        description={`Cliente: ${client.nome ?? ''} ${client.cognome ?? ''}`.trim()}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">Annulla</button>
            <button type="button" onClick={save} disabled={loading || !content.trim()} className="btn-primary text-sm">
              {loading ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Contenuto</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Annotazioni cliniche, osservazioni, follow-up…"
              className="input-field resize-y"
            />
          </div>
          <div>
            <label className="input-label">Tag</label>
            <div className="flex flex-wrap gap-1.5">
              {TAG_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${tags.includes(t) ? 'bg-teal-light border-teal-light text-teal-dark' : 'bg-white border-surface-border text-anthracite-lighter hover:border-teal'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
