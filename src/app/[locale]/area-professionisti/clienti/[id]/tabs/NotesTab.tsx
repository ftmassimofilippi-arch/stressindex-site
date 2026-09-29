'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Plus, Trash2, Edit3, Bell } from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { createClient } from '@/lib/supabase-browser'
import { formatDate } from '@/lib/format'
import type { Client, ClientNote, NoteCategory } from '@/lib/types'
import { NOTE_CATEGORIES } from '@/lib/types'
import { useRouter } from '@/i18n/navigation'
import type { Tr } from '@/i18n/types'

// I valori di categoria e dei tag preset restano quelli salvati nel database
// (in italiano): qui cambia solo l'etichetta mostrata, presa da `notes.*`.
const CATEGORY_KEY: Record<NoteCategory, string> = {
  'valutazione': 'assessment',
  'follow-up': 'followUp',
  'post-trattamento': 'postSession',
  'anamnesi': 'history',
  'altro': 'other',
}

const TAG_PRESETS: Array<{ value: string; key: string }> = [
  { value: 'urgente', key: 'urgent' },
  { value: 'da rivedere', key: 'toReview' },
  { value: 'documentazione', key: 'documentation' },
  { value: 'protocollo', key: 'protocol' },
]

/** Etichetta di una categoria salvata (`t` = traduttore di `notes`). */
export function noteCategoryLabel(value: string, t: Tr): string {
  const key = CATEGORY_KEY[value as NoteCategory]
  return key ? t(`categories.${key}`) : value
}

/** Etichetta di un tag di nota: i preset sono tradotti, i liberi restano tali e quali. */
export function noteTagLabel(value: string, t: Tr): string {
  const preset = TAG_PRESETS.find((p) => p.value === value)
  return preset ? t(`tagPresets.${preset.key}`) : value
}

export function NotesTab({ client, initialNotes }: { client: Client; initialNotes: ClientNote[] }) {
  const t = useTranslations('notes')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const [notes, setNotes] = useState<ClientNote[]>(initialNotes)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testo, setTesto] = useState('')
  const [categoria, setCategoria] = useState<NoteCategory | ''>('')
  const [dataReminder, setDataReminder] = useState<string>('')
  const [tags, setTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | ''>('')
  const [loading, setLoading] = useState(false)

  function startNew() {
    setEditingId(null); setTesto(''); setCategoria(''); setDataReminder(''); setTags([]); setOpen(true)
  }
  function startEdit(n: ClientNote) {
    setEditingId(n.id)
    setTesto(n.testo)
    setCategoria((n.categoria as NoteCategory) ?? '')
    setDataReminder(n.data_reminder ? n.data_reminder.slice(0, 10) : '')
    setTags(n.tags ?? [])
    setOpen(true)
  }

  function toggleTag(tag: string) {
    setTags((arr) => arr.includes(tag) ? arr.filter((x) => x !== tag) : [...arr, tag])
  }

  async function save() {
    if (!testo.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const payload = {
      testo,
      categoria: categoria || null,
      data_reminder: dataReminder ? new Date(dataReminder).toISOString() : null,
      tags,
    }

    if (editingId) {
      const { data, error } = await supabase
        .from('client_notes')
        .update(payload)
        .eq('id', editingId)
        .select()
        .maybeSingle()
      if (!error && data) setNotes((n) => n.map((x) => x.id === editingId ? (data as ClientNote) : x))
    } else {
      const { data, error } = await supabase
        .from('client_notes')
        .insert({
          professionista_id: user.id,
          client_id: client.id,
          data_creazione: new Date().toISOString(),
          ...payload,
        })
        .select()
        .maybeSingle()
      if (!error && data) setNotes((n) => [data as ClientNote, ...n])
    }
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm(t('deleteConfirm'))) return
    const supabase = createClient()
    await supabase.from('client_notes').delete().eq('id', id)
    setNotes((n) => n.filter((x) => x.id !== id))
  }

  const filtered = notes.filter((n) => {
    if (search && !n.testo.toLowerCase().includes(search.toLowerCase())) return false
    if (categoryFilter && n.categoria !== categoryFilter) return false
    return true
  })

  const now = Date.now()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-white border border-surface-border rounded-xl"
          />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as NoteCategory | '')} className="px-3 py-2 text-sm bg-white border border-surface-border rounded-xl">
            <option value="">{t('allCategories')}</option>
            {NOTE_CATEGORIES.map((c) => <option key={c} value={c}>{noteCategoryLabel(c, t)}</option>)}
          </select>
        </div>
        <button type="button" onClick={startNew} className="btn-primary text-sm inline-flex items-center gap-1.5">
          <Plus size={15} /> {t('newNote')}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={Edit3} title={t('emptyTitle')} description={t('emptyBody')} action={{ label: t('newNote'), onClick: startNew }} />
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((n) => {
            const reminderFuture = n.data_reminder && new Date(n.data_reminder).getTime() > now
            return (
              <li key={n.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-anthracite-lighter">{formatDate(n.data_creazione, 'd MMMM yyyy', locale)}</span>
                    {n.categoria && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal text-white">
                        {noteCategoryLabel(n.categoria, t)}
                      </span>
                    )}
                    {(n.tags ?? []).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] bg-teal-light text-teal-dark">{noteTagLabel(tag, t)}</span>
                    ))}
                    {reminderFuture && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-700" title={t('reminderTitle', { date: formatDate(n.data_reminder!, 'd MMM yyyy', locale) })}>
                        <Bell size={11} /> {formatDate(n.data_reminder!, 'd MMM', locale)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => startEdit(n)} className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center" aria-label={t('edit')}>
                      <Edit3 size={14} />
                    </button>
                    <button type="button" onClick={() => remove(n.id)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center" aria-label={t('delete')}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-anthracite whitespace-pre-wrap leading-relaxed">{n.testo}</p>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? t('editNote') : t('newNote')}
        description={t('client', { name: `${client.nome ?? ''} ${client.cognome ?? ''}`.trim() })}
        size="lg"
        footer={
          <div className="flex justify-end gap-2 flex-wrap">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">{tCommon('cancel')}</button>
            <button type="button" onClick={save} disabled={loading || !testo.trim()} className="btn-primary text-sm">
              {loading ? t('saving') : tCommon('save')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">{t('text')}</label>
            <textarea
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              rows={6}
              placeholder={t('textPlaceholder')}
              className="input-field resize-y"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">{t('category')}</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as NoteCategory | '')} className="input-field">
                <option value="">{t('noCategory')}</option>
                {NOTE_CATEGORIES.map((c) => <option key={c} value={c}>{noteCategoryLabel(c, t)}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">{t('reminder')}</label>
              <input type="date" value={dataReminder} onChange={(e) => setDataReminder(e.target.value)} className="input-field" />
              <p className="text-xs text-anthracite-lighter mt-1">{t('reminderHint')}</p>
            </div>
          </div>

          <div>
            <label className="input-label">{t('tags')}</label>
            <div className="flex flex-wrap gap-1.5">
              {TAG_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => toggleTag(p.value)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${tags.includes(p.value) ? 'bg-teal-light border-teal-light text-teal-dark' : 'bg-white border-surface-border text-anthracite-lighter hover:border-teal'}`}
                >
                  {t(`tagPresets.${p.key}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
