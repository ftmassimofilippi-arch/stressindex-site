'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { createClient } from '@/lib/supabase-browser'
import { fullName } from '@/lib/format'
import type { Client, ClientSettings } from '@/lib/types'

type Props = { client: Client; initialSettings: ClientSettings | null }

export function ClientSettingsTab({ client, initialSettings }: Props) {
  const router = useRouter()
  const [data, setData] = useState({
    nome: client.nome ?? '',
    cognome: client.cognome ?? '',
    email: client.email ?? '',
    telefono: client.telefono ?? '',
    data_nascita: client.data_nascita ?? '',
    sesso: client.sesso ?? 'M' as 'M' | 'F' | 'X',
    peso: client.peso ?? null,
    altezza: client.altezza ?? null,
    fumatore: client.fumatore ?? false,
    atleta: client.atleta ?? false,
    livello_attivita: client.livello_attivita ?? '',
  })

  const [settings, setSettings] = useState({
    expected_frequency_per_week: initialSettings?.expected_frequency_per_week ?? 0,
    alert_threshold_stress: initialSettings?.alert_threshold_stress ?? 80,
    alert_threshold_recovery: initialSettings?.alert_threshold_recovery ?? 30,
    alert_threshold_balance: initialSettings?.alert_threshold_balance ?? 30,
    alert_threshold_energy: initialSettings?.alert_threshold_energy ?? 30,
    tags: initialSettings?.tags ?? [] as string[],
  })

  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function addTag() {
    const t = tagInput.trim()
    if (!t) return
    if (!settings.tags.includes(t)) setSettings((s) => ({ ...s, tags: [...s.tags, t] }))
    setTagInput('')
  }

  async function save() {
    setSaving(true); setSavedMsg(null)
    const supabase = createClient()
    const { error: ce } = await supabase
      .from('clients')
      .update({
        nome: data.nome, cognome: data.cognome, email: data.email, telefono: data.telefono,
        data_nascita: data.data_nascita || null, sesso: data.sesso, peso: data.peso, altezza: data.altezza,
        fumatore: data.fumatore, atleta: data.atleta, livello_attivita: data.livello_attivita,
      })
      .eq('id', client.id)

    const { error: se } = await supabase
      .from('client_settings')
      .upsert({ client_id: client.id, ...settings })

    setSaving(false)
    if (ce || se) {
      setSavedMsg('Errore di salvataggio: ' + ((ce ?? se)?.message ?? ''))
    } else {
      setSavedMsg('Modifiche salvate')
      router.refresh()
      setTimeout(() => setSavedMsg(null), 3000)
    }
  }

  async function deleteClient() {
    const supabase = createClient()
    await supabase.from('clients').delete().eq('id', client.id)
    router.push('/area-professionisti/clienti')
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h3 className="font-serif text-lg text-anthracite mb-4">Anagrafica</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Nome</label>
            <input value={data.nome} onChange={(e) => setData({ ...data, nome: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">Cognome</label>
            <input value={data.cognome} onChange={(e) => setData({ ...data, cognome: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">Email</label>
            <input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">Telefono</label>
            <input value={data.telefono} onChange={(e) => setData({ ...data, telefono: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">Data di nascita</label>
            <input type="date" value={data.data_nascita} onChange={(e) => setData({ ...data, data_nascita: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">Sesso</label>
            <select value={data.sesso} onChange={(e) => setData({ ...data, sesso: e.target.value as 'M' | 'F' | 'X' })} className="input-field">
              <option value="M">Maschio</option>
              <option value="F">Femmina</option>
              <option value="X">Altro</option>
            </select>
          </div>
          <div>
            <label className="input-label">Peso (kg)</label>
            <input type="number" value={data.peso ?? ''} onChange={(e) => setData({ ...data, peso: e.target.value ? Number(e.target.value) : null })} className="input-field" />
          </div>
          <div>
            <label className="input-label">Altezza (cm)</label>
            <input type="number" value={data.altezza ?? ''} onChange={(e) => setData({ ...data, altezza: e.target.value ? Number(e.target.value) : null })} className="input-field" />
          </div>
          <div>
            <label className="input-label">Livello attività</label>
            <select value={data.livello_attivita} onChange={(e) => setData({ ...data, livello_attivita: e.target.value })} className="input-field">
              <option value="">—</option>
              <option value="sedentario">Sedentario</option>
              <option value="leggero">Leggero</option>
              <option value="moderato">Moderato</option>
              <option value="alto">Alto</option>
              <option value="agonistico">Agonistico</option>
            </select>
          </div>
          <div className="flex items-center gap-6 mt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!data.fumatore} onChange={(e) => setData({ ...data, fumatore: e.target.checked })} className="w-4 h-4 rounded text-teal" />
              Fumatore
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!data.atleta} onChange={(e) => setData({ ...data, atleta: e.target.checked })} className="w-4 h-4 rounded text-teal" />
              Atleta
            </label>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h3 className="font-serif text-lg text-anthracite mb-4">Tag e preferenze</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="input-label">Tag</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {settings.tags.map((t) => (
                <button key={t} type="button" onClick={() => setSettings((s) => ({ ...s, tags: s.tags.filter((x) => x !== t) }))} className="px-2.5 py-1 rounded-full text-xs bg-teal-light text-teal-dark hover:bg-teal hover:text-white transition-colors">
                  {t} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Aggiungi tag..."
                className="input-field flex-1"
              />
              <button type="button" onClick={addTag} className="btn-secondary text-sm">Aggiungi</button>
            </div>
          </div>

          <div>
            <label className="input-label">Frequenza misurazione attesa (volte / settimana)</label>
            <input
              type="number" min={0} max={14}
              value={settings.expected_frequency_per_week}
              onChange={(e) => setSettings({ ...settings, expected_frequency_per_week: Number(e.target.value) })}
              className="input-field"
            />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h3 className="font-serif text-lg text-anthracite mb-1">Soglie alert</h3>
        <p className="text-xs text-anthracite-lighter mb-4">Genera un alert quando il valore supera/scende sotto queste soglie</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { key: 'alert_threshold_stress', label: 'Stress (≥)', max: 100 },
            { key: 'alert_threshold_recovery', label: 'Recupero (≤)', max: 100 },
            { key: 'alert_threshold_balance', label: 'Equilibrio (≤)', max: 100 },
            { key: 'alert_threshold_energy', label: 'Energia (≤)', max: 100 },
          ].map(({ key, label, max }) => {
            const k = key as keyof typeof settings
            return (
              <div key={key}>
                <label className="input-label">{label}</label>
                <input
                  type="range" min={0} max={max} value={settings[k] as number}
                  onChange={(e) => setSettings({ ...settings, [k]: Number(e.target.value) })}
                  className="w-full accent-teal"
                />
                <div className="text-sm text-anthracite mt-1">{settings[k] as number}</div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 flex-wrap">
        {savedMsg && <span className="text-sm text-emerald-600">{savedMsg}</span>}
        <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
          <Save size={15} /> {saving ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
      </div>

      <section className="card p-6 border-2 border-red-100 bg-red-50/30">
        <h3 className="font-serif text-lg text-red-700 mb-1">Zona pericolosa</h3>
        <p className="text-sm text-anthracite-lighter mb-4">L&apos;eliminazione del cliente rimuove anche tutte le misurazioni e note collegate. L&apos;operazione è irreversibile.</p>
        <button type="button" onClick={() => setDeleteOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors">
          <Trash2 size={15} /> Elimina cliente
        </button>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteClient}
        title="Eliminare definitivamente il cliente?"
        description="Tutte le misurazioni, note e messaggi collegati saranno eliminati."
        confirmText="Elimina definitivamente"
        destructive
        requireTypedConfirmation={fullName(client) || 'ELIMINA'}
      />
    </div>
  )
}
