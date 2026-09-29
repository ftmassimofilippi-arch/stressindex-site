'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Save, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { createClient } from '@/lib/supabase-browser'
import { fullName } from '@/lib/format'
import type { Client, ClientSettings } from '@/lib/types'
import { ClientAccessSection } from '../ClientAccessSection'
import { AlertRulesSection } from '@/components/dashboard/AlertRulesSection'
import type { AlertRule } from '@/lib/alert-rules'

type Props = { client: Client; initialSettings: ClientSettings | null; alertRules?: AlertRule[]; professionalId?: string | null }

// Valori salvati in clients.livello_attivita (invariati); l'etichetta viene da
// clients.settings.activity.*.
const ACTIVITY_LEVELS = ['sedentario', 'leggero', 'moderato', 'alto', 'agonistico'] as const

// Soglie del sito: colonna di client_settings → nome dello score in scores.names.*.
const THRESHOLDS = [
  { key: 'alert_threshold_stress', nameKey: 'stress', sign: '≥' },
  { key: 'alert_threshold_recovery', nameKey: 'recovery', sign: '≤' },
  { key: 'alert_threshold_balance', nameKey: 'balance', sign: '≤' },
  { key: 'alert_threshold_energy', nameKey: 'energy', sign: '≤' },
] as const

export function ClientSettingsTab({ client, initialSettings, alertRules = [], professionalId = null }: Props) {
  const t = useTranslations('clients.settings')
  const tScores = useTranslations('scores')
  const tCommon = useTranslations('common')
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
    const tag = tagInput.trim()
    if (!tag) return
    if (!settings.tags.includes(tag)) setSettings((s) => ({ ...s, tags: [...s.tags, tag] }))
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
      setSavedMsg(t('saveError', { message: (ce ?? se)?.message ?? '' }))
    } else {
      setSavedMsg(t('saved'))
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
        <h3 className="font-serif text-lg text-anthracite mb-4">{t('personal')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="input-label">{t('firstName')}</label>
            <input value={data.nome} onChange={(e) => setData({ ...data, nome: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('lastName')}</label>
            <input value={data.cognome} onChange={(e) => setData({ ...data, cognome: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('email')}</label>
            <input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('phone')}</label>
            <input value={data.telefono} onChange={(e) => setData({ ...data, telefono: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('birthDate')}</label>
            <input type="date" value={data.data_nascita} onChange={(e) => setData({ ...data, data_nascita: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('sex')}</label>
            <select value={data.sesso} onChange={(e) => setData({ ...data, sesso: e.target.value as 'M' | 'F' | 'X' })} className="input-field">
              <option value="M">{t('sexM')}</option>
              <option value="F">{t('sexF')}</option>
              <option value="X">{t('sexX')}</option>
            </select>
          </div>
          <div>
            <label className="input-label">{t('weight')}</label>
            <input type="number" value={data.peso ?? ''} onChange={(e) => setData({ ...data, peso: e.target.value ? Number(e.target.value) : null })} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('height')}</label>
            <input type="number" value={data.altezza ?? ''} onChange={(e) => setData({ ...data, altezza: e.target.value ? Number(e.target.value) : null })} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('activityLevel')}</label>
            <select value={data.livello_attivita} onChange={(e) => setData({ ...data, livello_attivita: e.target.value })} className="input-field">
              <option value="">—</option>
              {ACTIVITY_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{t(`activity.${lvl}`)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-6 mt-2 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!data.fumatore} onChange={(e) => setData({ ...data, fumatore: e.target.checked })} className="w-4 h-4 rounded text-teal" />
              {t('smoker')}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!data.atleta} onChange={(e) => setData({ ...data, atleta: e.target.checked })} className="w-4 h-4 rounded text-teal" />
              {t('athlete')}
            </label>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h3 className="font-serif text-lg text-anthracite mb-4">{t('tagsTitle')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="input-label">{t('tags')}</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {settings.tags.map((tag) => (
                <button key={tag} type="button" onClick={() => setSettings((s) => ({ ...s, tags: s.tags.filter((x) => x !== tag) }))} aria-label={t('removeTag', { tag })} className="px-2.5 py-1 rounded-full text-xs bg-teal-light text-teal-dark hover:bg-teal hover:text-white transition-colors">
                  {tag} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder={t('addTagPlaceholder')}
                className="input-field flex-1 min-w-0"
              />
              <button type="button" onClick={addTag} className="btn-secondary text-sm whitespace-nowrap">{t('add')}</button>
            </div>
          </div>

          <div>
            <label className="input-label">{t('frequency')}</label>
            <input
              type="number" min={0} max={14}
              value={settings.expected_frequency_per_week}
              onChange={(e) => setSettings({ ...settings, expected_frequency_per_week: Number(e.target.value) })}
              className="input-field"
            />
          </div>
        </div>
      </section>

      <AlertRulesSection clientId={client.id} rules={alertRules} professionalId={professionalId} />

      <section className="card p-6">
        <h3 className="font-serif text-lg text-anthracite mb-1">{t('thresholdsTitle')}</h3>
        <p className="text-xs text-anthracite-lighter mb-4">{t('thresholdsSubtitle')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {THRESHOLDS.map(({ key, nameKey, sign }) => {
            const k = key as keyof typeof settings
            return (
              <div key={key}>
                <label className="input-label">{tScores(`names.${nameKey}`)} ({sign})</label>
                <input
                  type="range" min={0} max={100} value={settings[k] as number}
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
          <Save size={15} /> {saving ? t('saving') : t('save')}
        </button>
      </div>

      <ClientAccessSection clientId={client.id} clientName={fullName(client) || t('theClient')} />

      <section className="card p-6 border-2 border-red-100 bg-red-50/30">
        <h3 className="font-serif text-lg text-red-700 mb-1">{t('dangerTitle')}</h3>
        <p className="text-sm text-anthracite-lighter mb-4">{t('dangerBody')}</p>
        <button type="button" onClick={() => setDeleteOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors">
          <Trash2 size={15} /> {t('deleteClient')}
        </button>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteClient}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmBody')}
        confirmText={t('deleteConfirm')}
        cancelText={tCommon('cancel')}
        destructive
        requireTypedConfirmation={fullName(client) || t('deleteTyped')}
      />
    </div>
  )
}
