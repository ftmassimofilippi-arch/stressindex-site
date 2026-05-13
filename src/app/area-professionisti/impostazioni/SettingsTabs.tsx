'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, LogOut, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { createClient } from '@/lib/supabase-browser'
import type { NotificationPreferences, ProfessionalProfile } from '@/lib/types'

type Props = {
  professional: ProfessionalProfile | null
  preferences: NotificationPreferences | null
}

const TABS = [
  { id: 'profilo', label: 'Profilo' },
  { id: 'notifiche', label: 'Notifiche' },
  { id: 'account', label: 'Account' },
] as const

type TabId = typeof TABS[number]['id']

export function SettingsTabs({ professional, preferences }: Props) {
  const [tab, setTab] = useState<TabId>('profilo')

  return (
    <>
      <div className="flex gap-1 border-b border-surface-border mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-teal text-teal-dark' : 'border-transparent text-anthracite-lighter hover:text-anthracite'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profilo' && <ProfiloTab professional={professional} />}
      {tab === 'notifiche' && <NotificheTab preferences={preferences} />}
      {tab === 'account' && <AccountTab />}
    </>
  )
}

function ProfiloTab({ professional }: { professional: ProfessionalProfile | null }) {
  const router = useRouter()
  const [data, setData] = useState({
    titolo: professional?.titolo ?? '',
    nome: professional?.nome ?? '',
    cognome: professional?.cognome ?? '',
    professione: professional?.professione ?? '',
    specializzazione: professional?.specializzazione ?? '',
    nome_studio: professional?.nome_studio ?? '',
    indirizzo: professional?.indirizzo ?? '',
    telefono: professional?.telefono ?? '',
    sito_web: professional?.sito_web ?? '',
    logo_url: professional?.logo_url ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    setSaving(true); setMsg(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error } = await supabase
      .from('professional_profiles')
      .upsert({ id: user.id, ...data })
    setSaving(false)
    if (error) setMsg('Errore: ' + error.message)
    else { setMsg('Profilo aggiornato'); router.refresh(); setTimeout(() => setMsg(null), 3000) }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-4">Dati professionista</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Titolo</label>
            <select value={data.titolo} onChange={(e) => setData({ ...data, titolo: e.target.value })} className="input-field">
              <option value="">—</option>
              <option value="Dott.">Dott.</option>
              <option value="Dott.ssa">Dott.ssa</option>
              <option value="Prof.">Prof.</option>
              <option value="Prof.ssa">Prof.ssa</option>
            </select>
          </div>
          <div>
            <label className="input-label">Professione</label>
            <input value={data.professione} onChange={(e) => setData({ ...data, professione: e.target.value })} className="input-field" placeholder="Es. Fisioterapista" />
          </div>
          <div>
            <label className="input-label">Nome</label>
            <input value={data.nome} onChange={(e) => setData({ ...data, nome: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">Cognome</label>
            <input value={data.cognome} onChange={(e) => setData({ ...data, cognome: e.target.value })} className="input-field" />
          </div>
          <div className="md:col-span-2">
            <label className="input-label">Specializzazione</label>
            <input value={data.specializzazione} onChange={(e) => setData({ ...data, specializzazione: e.target.value })} className="input-field" />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-4">Studio</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="input-label">Nome studio</label>
            <input value={data.nome_studio} onChange={(e) => setData({ ...data, nome_studio: e.target.value })} className="input-field" />
          </div>
          <div className="md:col-span-2">
            <label className="input-label">Indirizzo</label>
            <input value={data.indirizzo} onChange={(e) => setData({ ...data, indirizzo: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">Telefono</label>
            <input value={data.telefono} onChange={(e) => setData({ ...data, telefono: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">Sito web</label>
            <input value={data.sito_web} onChange={(e) => setData({ ...data, sito_web: e.target.value })} className="input-field" placeholder="https://" />
          </div>
          <div className="md:col-span-2">
            <label className="input-label">URL logo (per ora link diretto)</label>
            <input value={data.logo_url} onChange={(e) => setData({ ...data, logo_url: e.target.value })} className="input-field" placeholder="https://example.com/logo.png" />
            <p className="text-xs text-anthracite-lighter mt-1">Apparirà nell&apos;intestazione dei PDF generati.</p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 flex-wrap">
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
          <Save size={15} /> {saving ? 'Salvataggio…' : 'Salva profilo'}
        </button>
      </div>
    </div>
  )
}

function NotificheTab({ preferences }: { preferences: NotificationPreferences | null }) {
  const router = useRouter()
  const [data, setData] = useState({
    weekly_summary_email: preferences?.weekly_summary_email ?? true,
    weekly_summary_day: (preferences?.weekly_summary_day ?? 'monday') as NotificationPreferences['weekly_summary_day'],
    weekly_summary_time: preferences?.weekly_summary_time ?? '08:00',
    alert_email_enabled: preferences?.alert_email_enabled ?? false,
    marketing_email_enabled: preferences?.marketing_email_enabled ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    setSaving(true); setMsg(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...data })
    setSaving(false)
    if (error) setMsg('Errore: ' + error.message)
    else { setMsg('Preferenze salvate'); router.refresh(); setTimeout(() => setMsg(null), 3000) }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6 space-y-5">
        <Switch
          label="Riassunto settimanale via email"
          desc="Ricevi ogni settimana un riepilogo della tua attività clinica"
          checked={data.weekly_summary_email}
          onChange={(v) => setData({ ...data, weekly_summary_email: v })}
        />
        {data.weekly_summary_email && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-1">
            <div>
              <label className="input-label">Giorno</label>
              <select value={data.weekly_summary_day} onChange={(e) => setData({ ...data, weekly_summary_day: e.target.value as any })} className="input-field">
                <option value="monday">Lunedì</option>
                <option value="tuesday">Martedì</option>
                <option value="wednesday">Mercoledì</option>
                <option value="thursday">Giovedì</option>
                <option value="friday">Venerdì</option>
                <option value="saturday">Sabato</option>
                <option value="sunday">Domenica</option>
              </select>
            </div>
            <div>
              <label className="input-label">Ora</label>
              <input type="time" value={data.weekly_summary_time} onChange={(e) => setData({ ...data, weekly_summary_time: e.target.value })} className="input-field" />
            </div>
          </div>
        )}
        <Switch
          label="Alert email immediati"
          desc="Ricevi una email ogni volta che si genera un alert ad alta severità"
          checked={data.alert_email_enabled}
          onChange={(v) => setData({ ...data, alert_email_enabled: v })}
        />
        <Switch
          label="Marketing e novità prodotto"
          desc="Aggiornamenti su nuove funzionalità di Stress Index"
          checked={data.marketing_email_enabled}
          onChange={(v) => setData({ ...data, marketing_email_enabled: v })}
        />
      </section>

      <div className="flex items-center justify-end gap-3 flex-wrap">
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
          <Save size={15} /> {saving ? 'Salvataggio…' : 'Salva preferenze'}
        </button>
      </div>
    </div>
  )
}

function AccountTab() {
  const router = useRouter()
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [email, setEmail] = useState<string>('')

  // load email
  if (typeof window !== 'undefined' && !email) {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setEmail(user.email ?? '')
    })
  }

  async function changePassword() {
    setErr(null); setMsg(null)
    if (newPw.length < 8) { setErr('La nuova password deve avere almeno 8 caratteri'); return }
    if (newPw !== confirmPw) { setErr('Le due password non coincidono'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSaving(false)
    if (error) setErr(error.message)
    else { setMsg('Password aggiornata'); setOldPw(''); setNewPw(''); setConfirmPw(''); setTimeout(() => setMsg(null), 3000) }
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/area-professionisti/login')
  }

  async function deleteAccount() {
    // Eliminazione completa account richiede service_role, va fatta via Edge Function dedicata.
    // Per ora effettuiamo solo signOut e mostriamo guidance.
    alert('Per cancellare definitivamente l\'account contattaci a hello@stressindex.io. Per ora effettuo solo logout.')
    await logout()
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-4">Email</h2>
        <input type="email" value={email} readOnly className="input-field bg-surface cursor-not-allowed" />
        <p className="text-xs text-anthracite-lighter mt-2">Per cambiare email contattaci a hello@stressindex.io</p>
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-4">Cambio password</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="input-label">Nuova password</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="input-field" autoComplete="new-password" />
          </div>
          <div>
            <label className="input-label">Conferma nuova password</label>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="input-field" autoComplete="new-password" />
          </div>
          {err && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
          {msg && <div className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{msg}</div>}
          <button type="button" onClick={changePassword} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Aggiornamento…' : 'Aggiorna password'}
          </button>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-2">Abbonamento</h2>
        <p className="text-sm text-anthracite-lighter mb-3">Per gestione e fatturazione contattaci a hello@stressindex.io</p>
        <button type="button" disabled className="btn-secondary text-sm opacity-60 cursor-not-allowed">Gestisci abbonamento</button>
      </section>

      <section className="card p-6">
        <button type="button" onClick={logout} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-surface-border hover:bg-surface">
          <LogOut size={15} /> Esci dall&apos;account
        </button>
      </section>

      <section className="card p-6 border-2 border-red-100 bg-red-50/30">
        <h2 className="font-serif text-lg text-red-700 mb-1">Zona pericolosa</h2>
        <p className="text-sm text-anthracite-lighter mb-3">L&apos;eliminazione dell&apos;account rimuove tutti i dati associati.</p>
        <button type="button" onClick={() => setDeleteOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white">
          <Trash2 size={15} /> Elimina account
        </button>
        <ConfirmDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={deleteAccount}
          title="Eliminare definitivamente l'account?"
          description="L'operazione è irreversibile."
          confirmText="Elimina"
          destructive
          requireTypedConfirmation="ELIMINA"
        />
      </section>
    </div>
  )
}

function Switch({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div className="flex-1">
        <div className="text-sm font-medium text-anthracite">{label}</div>
        {desc && <div className="text-xs text-anthracite-lighter mt-0.5">{desc}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-teal' : 'bg-surface-border'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  )
}
