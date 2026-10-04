'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Save, LogOut, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { createClient } from '@/lib/supabase-browser'
import type { NotificationPreferences, ProfessionalProfile } from '@/lib/types'

type Props = {
  professional: ProfessionalProfile | null
  preferences: NotificationPreferences | null
  /** Scheda da aprire: arriva da ?tab=, così il link "cambia preferenze" delle email atterra qui. */
  initialTab?: string
}

const TAB_IDS = ['profilo', 'notifiche', 'account'] as const

type TabId = typeof TAB_IDS[number]

function asTabId(v: string | undefined): TabId {
  return TAB_IDS.some((id) => id === v) ? (v as TabId) : 'profilo'
}

export function SettingsTabs({ professional, preferences, initialTab }: Props) {
  const t = useTranslations('settings.tabs')
  const [tab, setTab] = useState<TabId>(() => asTabId(initialTab))
  const labels: Record<TabId, string> = { profilo: t('profile'), notifiche: t('notifications'), account: t('account') }

  return (
    <>
      <div className="flex gap-1 border-b border-surface-border mb-6 overflow-x-auto">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === id ? 'border-teal text-teal-dark' : 'border-transparent text-anthracite-lighter hover:text-anthracite'
            }`}
          >
            {labels[id]}
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
  const t = useTranslations('settings.profile')
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
    if (error) setMsg(t('error', { message: error.message }))
    else { setMsg(t('saved')); router.refresh(); setTimeout(() => setMsg(null), 3000) }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-4">{t('professionalData')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="input-label">{t('titleLabel')}</label>
            {/* I titoli sono valori salvati nel profilo e stampati nei PDF: restano nella forma scelta dal professionista. */}
            <select value={data.titolo} onChange={(e) => setData({ ...data, titolo: e.target.value })} className="input-field">
              <option value="">—</option>
              <option value="Dott.">Dott.</option>
              <option value="Dott.ssa">Dott.ssa</option>
              <option value="Dr.">Dr.</option>
              <option value="Prof.">Prof.</option>
              <option value="Prof.ssa">Prof.ssa</option>
            </select>
          </div>
          <div>
            <label className="input-label">{t('profession')}</label>
            <input value={data.professione} onChange={(e) => setData({ ...data, professione: e.target.value })} className="input-field" placeholder={t('professionPlaceholder')} />
          </div>
          <div>
            <label className="input-label">{t('firstName')}</label>
            <input value={data.nome} onChange={(e) => setData({ ...data, nome: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('lastName')}</label>
            <input value={data.cognome} onChange={(e) => setData({ ...data, cognome: e.target.value })} className="input-field" />
          </div>
          <div className="md:col-span-2">
            <label className="input-label">{t('specialization')}</label>
            <input value={data.specializzazione} onChange={(e) => setData({ ...data, specializzazione: e.target.value })} className="input-field" />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-4">{t('practice')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="input-label">{t('practiceName')}</label>
            <input value={data.nome_studio} onChange={(e) => setData({ ...data, nome_studio: e.target.value })} className="input-field" />
          </div>
          <div className="md:col-span-2">
            <label className="input-label">{t('address')}</label>
            <input value={data.indirizzo} onChange={(e) => setData({ ...data, indirizzo: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('phone')}</label>
            <input value={data.telefono} onChange={(e) => setData({ ...data, telefono: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="input-label">{t('website')}</label>
            <input value={data.sito_web} onChange={(e) => setData({ ...data, sito_web: e.target.value })} className="input-field" placeholder="https://" />
          </div>
          <div className="md:col-span-2">
            <label className="input-label">{t('logoUrl')}</label>
            <input value={data.logo_url} onChange={(e) => setData({ ...data, logo_url: e.target.value })} className="input-field" placeholder="https://example.com/logo.png" />
            <p className="text-xs text-anthracite-lighter mt-1">{t('logoHelp')}</p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 flex-wrap">
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
          <Save size={15} /> {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  )
}

// Fusi proposti nel menu. `Intl.supportedValuesOf` copre tutto ma non esiste
// ovunque: in quel caso resta questa lista breve, che basta a chi lavora in
// Italia e nei paesi vicini.
const FUSI_BASE = [
  'Europe/Rome', 'Europe/Zurich', 'Europe/Vienna', 'Europe/Berlin', 'Europe/Paris',
  'Europe/Madrid', 'Europe/London', 'Europe/Lisbon', 'Europe/Athens', 'UTC',
]

function fusiDisponibili(selezionato: string): string[] {
  let lista = FUSI_BASE
  try {
    const tutti = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone')
    if (tutti?.length) lista = tutti
  } catch {
    /* lista breve */
  }
  return lista.includes(selezionato) ? lista : [selezionato, ...lista]
}

const ORE = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)

// Modalità di notifica: i valori sono quelli salvati in notification_preferences.
const MODI: NotificationPreferences['on_client_measurement'][] = ['subito', 'riepilogo', 'mai']
const GIORNI: NotificationPreferences['weekly_summary_day'][] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const LINGUE: NotificationPreferences['lingua'][] = ['it', 'en', 'de']

function NotificheTab({ preferences }: { preferences: NotificationPreferences | null }) {
  const t = useTranslations('settings.notifications')
  const router = useRouter()
  const [data, setData] = useState({
    weekly_summary_email: preferences?.weekly_summary_email ?? true,
    weekly_summary_day: (preferences?.weekly_summary_day ?? 'monday') as NotificationPreferences['weekly_summary_day'],
    weekly_summary_time: preferences?.weekly_summary_time ?? '08:00',
    alert_email_enabled: preferences?.alert_email_enabled ?? false,
    marketing_emails: preferences?.marketing_emails ?? true,
    on_client_measurement: (preferences?.on_client_measurement ?? 'riepilogo') as NotificationPreferences['on_client_measurement'],
    digest_hour: preferences?.digest_hour ?? 20,
    email_override: preferences?.email_override ?? '',
    timezone: preferences?.timezone ?? 'Europe/Rome',
    lingua: (preferences?.lingua ?? 'it') as NotificationPreferences['lingua'],
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setErr(null); setMsg(null)
    const override = data.email_override.trim()
    if (override && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(override)) {
      setErr(t('emailOverrideInvalid'))
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...data, email_override: override || null })
    setSaving(false)
    if (error) setErr(t('error', { message: error.message }))
    else { setMsg(t('saved')); router.refresh(); setTimeout(() => setMsg(null), 3000) }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-1">{t('measurementsTitle')}</h2>
        <p className="text-sm text-anthracite-lighter mb-5">{t('measurementsIntro')}</p>

        <div className="space-y-2">
          {MODI.map((m) => (
            <label
              key={m}
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                data.on_client_measurement === m
                  ? 'border-teal bg-teal-light/50'
                  : 'border-surface-border hover:bg-surface'
              }`}
            >
              <input
                type="radio"
                name="on_client_measurement"
                value={m}
                checked={data.on_client_measurement === m}
                onChange={() => setData({ ...data, on_client_measurement: m })}
                className="mt-0.5 accent-teal"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-anthracite">{t(`modes.${m}`)}</span>
                <span className="block text-xs text-anthracite-lighter mt-0.5">{t(`modes.${m}Desc`)}</span>
              </span>
            </label>
          ))}
        </div>

        {data.on_client_measurement !== 'mai' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-surface-border">
            {data.on_client_measurement === 'riepilogo' && (
              <>
                <div>
                  <label className="input-label">{t('digestHour')}</label>
                  <select
                    value={`${String(data.digest_hour).padStart(2, '0')}:00`}
                    onChange={(e) => setData({ ...data, digest_hour: Number(e.target.value.slice(0, 2)) })}
                    className="input-field"
                  >
                    {ORE.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">{t('timezone')}</label>
                  <select
                    value={data.timezone}
                    onChange={(e) => setData({ ...data, timezone: e.target.value })}
                    className="input-field"
                  >
                    {fusiDisponibili(data.timezone).map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <p className="text-xs text-anthracite-lighter mt-1">{t('timezoneHelp')}</p>
                </div>
              </>
            )}
            <div>
              <label className="input-label">{t('emailLanguage')}</label>
              <select
                value={data.lingua}
                onChange={(e) => setData({ ...data, lingua: e.target.value as NotificationPreferences['lingua'] })}
                className="input-field"
              >
                {LINGUE.map((l) => <option key={l} value={l}>{t(`languages.${l}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">{t('emailOverride')}</label>
              <input
                type="email"
                value={data.email_override}
                onChange={(e) => setData({ ...data, email_override: e.target.value })}
                className="input-field"
                placeholder={t('emailOverridePlaceholder')}
              />
            </div>
          </div>
        )}
      </section>

      <section className="card p-6 space-y-5">
        <Switch
          label={t('weeklySummary')}
          desc={t('weeklySummaryDesc')}
          checked={data.weekly_summary_email}
          onChange={(v) => setData({ ...data, weekly_summary_email: v })}
        />
        {data.weekly_summary_email && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-1">
            <div>
              <label className="input-label">{t('day')}</label>
              <select value={data.weekly_summary_day} onChange={(e) => setData({ ...data, weekly_summary_day: e.target.value as NotificationPreferences['weekly_summary_day'] })} className="input-field">
                {GIORNI.map((g) => <option key={g} value={g}>{t(`days.${g}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">{t('time')}</label>
              <input type="time" value={data.weekly_summary_time} onChange={(e) => setData({ ...data, weekly_summary_time: e.target.value })} className="input-field" />
            </div>
          </div>
        )}
        <Switch
          label={t('alertEmails')}
          desc={t('alertEmailsDesc')}
          checked={data.alert_email_enabled}
          onChange={(v) => setData({ ...data, alert_email_enabled: v })}
        />
        <Switch
          label={t('marketing')}
          desc={t('marketingDesc')}
          checked={data.marketing_emails}
          onChange={(v) => setData({ ...data, marketing_emails: v })}
        />
      </section>

      <div className="flex items-center justify-end gap-3 flex-wrap">
        {err && <span className="text-sm text-red-600">{err}</span>}
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
          <Save size={15} /> {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  )
}

function AccountTab() {
  const t = useTranslations('settings.account')
  const tErr = useTranslations('errors.api')
  const router = useRouter()
  const [deleteErr, setDeleteErr] = useState<string | null>(null)
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
    if (newPw.length < 8) { setErr(t('passwordTooShort')); return }
    if (newPw !== confirmPw) { setErr(t('passwordMismatch')); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSaving(false)
    if (error) setErr(error.message)
    else { setMsg(t('passwordUpdated')); setOldPw(''); setNewPw(''); setConfirmPw(''); setTimeout(() => setMsg(null), 3000) }
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/area-professionisti/login')
  }

  // Cancellazione GDPR (app-042): la Edge Function `delete-account` fa tutto in
  // una transazione lato database e toglie i file dai bucket dopo il commit.
  // Se fallisce, niente e' stato toccato: si mostra l'errore e si resta loggati.
  async function deleteAccount() {
    setDeleteErr(null)
    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke('delete-account', { body: {} })
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      let payload: Record<string, unknown> | null = (data as Record<string, unknown> | null) ?? null
      // supabase-js mette il corpo della risposta non-2xx in error.context
      if (!payload && error && 'context' in error) {
        try { payload = await (error as { context: Response }).context.json() } catch { payload = null }
      }
      const code = typeof payload?.code === 'string' ? payload.code : ''
      const message = code && tErr.has(code) ? tErr(code)
        : typeof payload?.message === 'string' && payload.message ? payload.message
        : error?.message ?? tErr('generic')
      setDeleteErr(t('deleteError', { message }))
      setDeleteOpen(false)
      return
    }
    await supabase.auth.signOut()
    router.push('/area-professionisti/login')
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-4">{t('email')}</h2>
        <input type="email" value={email} readOnly className="input-field bg-surface cursor-not-allowed" />
        <p className="text-xs text-anthracite-lighter mt-2">{t('emailHelp')}</p>
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-4">{t('changePassword')}</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="input-label">{t('newPassword')}</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="input-field" autoComplete="new-password" />
          </div>
          <div>
            <label className="input-label">{t('confirmPassword')}</label>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="input-field" autoComplete="new-password" />
          </div>
          {err && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
          {msg && <div className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{msg}</div>}
          <button type="button" onClick={changePassword} disabled={saving} className="btn-primary text-sm">
            {saving ? t('updating') : t('updatePassword')}
          </button>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg text-anthracite mb-2">{t('subscription')}</h2>
        <p className="text-sm text-anthracite-lighter mb-3">{t('subscriptionHelp')}</p>
        <button type="button" disabled className="btn-secondary text-sm opacity-60 cursor-not-allowed">{t('manageSubscription')}</button>
      </section>

      <section className="card p-6">
        <button type="button" onClick={logout} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-surface-border hover:bg-surface">
          <LogOut size={15} /> {t('logout')}
        </button>
      </section>

      <section className="card p-6 border-2 border-red-100 bg-red-50/30">
        <h2 className="font-serif text-lg text-red-700 mb-1">{t('dangerZone')}</h2>
        <p className="text-sm text-anthracite-lighter mb-3">{t('dangerHelp')}</p>
        {deleteErr && <div className="px-3 py-2 mb-3 rounded-xl bg-red-50 text-red-700 text-sm">{deleteErr}</div>}
        <button type="button" onClick={() => setDeleteOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white">
          <Trash2 size={15} /> {t('deleteAccount')}
        </button>
        <ConfirmDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={deleteAccount}
          title={t('deleteTitle')}
          description={t('deleteDescription')}
          confirmText={t('deleteConfirm')}
          destructive
          requireTypedConfirmation={t('deleteTyped')}
        />
      </section>
    </div>
  )
}

function Switch({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-anthracite">{label}</div>
        {desc && <div className="text-xs text-anthracite-lighter mt-0.5">{desc}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-teal' : 'bg-surface-border'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  )
}
