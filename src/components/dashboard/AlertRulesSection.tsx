'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { RotateCcw, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { num } from '@/lib/format'
import {
  PREDEFINED_ALERT_RULES,
  resolveRulesForClient,
  type AlertRule,
} from '@/lib/alert-rules'

// Sezione "Soglie avvisi" della scheda cliente. Stessa semantica dell'app
// (ClientAlertThresholds): di default il cliente segue le soglie generali del
// professionista (nessuna riga in alert_rules con il suo client_id).
// Spegnendo l'interruttore si creano gli override, precompilati con i valori
// generali in vigore; da lì le soglie del cliente sono indipendenti e hanno la
// precedenza. "Ripristina soglie generali" cancella gli override.
export function AlertRulesSection({
  clientId,
  rules,
  professionalId,
}: {
  clientId: string
  rules: AlertRule[]
  professionalId: string | null
}) {
  const t = useTranslations('alerts')
  const locale = useLocale()
  const router = useRouter()
  const globals = useMemo(() => resolveRulesForClient(rules.filter((r) => r.client_id == null), '__none__'), [rules])
  const initialOverrides = useMemo(
    () => new Map(rules.filter((r) => r.client_id === clientId).map((r) => [r.alert_type, r])),
    [rules, clientId],
  )

  const [useGlobal, setUseGlobal] = useState(initialOverrides.size === 0)
  const [draft, setDraft] = useState<Record<string, { enabled: boolean; threshold: number }>>(() => {
    const out: Record<string, { enabled: boolean; threshold: number }> = {}
    for (const p of PREDEFINED_ALERT_RULES) {
      const o = initialOverrides.get(p.id)
      const g = globals.get(p.id)
      out[p.id] = {
        enabled: o?.enabled ?? g?.enabled ?? true,
        threshold: o?.threshold_value ?? g?.threshold_value ?? p.defaultThreshold,
      }
    }
    return out
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function fillFromGlobals() {
    const out: Record<string, { enabled: boolean; threshold: number }> = {}
    for (const p of PREDEFINED_ALERT_RULES) {
      const g = globals.get(p.id)
      out[p.id] = { enabled: g?.enabled ?? true, threshold: g?.threshold_value ?? p.defaultThreshold }
    }
    setDraft(out)
  }

  async function toggleUseGlobal(next: boolean) {
    if (next) {
      await restoreGlobals()
    } else {
      fillFromGlobals()
      setUseGlobal(false)
    }
  }

  // Scrive le 9 righe di override del cliente (upsert sulla chiave logica
  // professionista + cliente + tipo, garantita dagli indici univoci della
  // migrazione alert_rules_client_override.sql).
  async function save() {
    if (!professionalId) {
      setMsg(t('rules.sessionInvalid'))
      return
    }
    setSaving(true)
    setMsg(null)
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('alert_rules')
      .select('id, alert_type')
      .eq('client_id', clientId)
    const byType = new Map(((existing ?? []) as Array<{ id: string; alert_type: string }>).map((r) => [r.alert_type, r.id]))
    let error: string | null = null
    for (const p of PREDEFINED_ALERT_RULES) {
      const d = draft[p.id]
      const row = {
        professionista_id: professionalId,
        client_id: clientId,
        alert_type: p.id,
        enabled: d.enabled,
        threshold_value: d.threshold,
      }
      const id = byType.get(p.id)
      const res = id
        ? await supabase.from('alert_rules').update(row).eq('id', id)
        : await supabase.from('alert_rules').insert(row)
      if (res.error) {
        error = res.error.message
        break
      }
    }
    setSaving(false)
    if (error) {
      setMsg(t('rules.saveError', { detail: error }))
    } else {
      setMsg(t('rules.saved'))
      router.refresh()
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function restoreGlobals() {
    setSaving(true)
    setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.from('alert_rules').delete().eq('client_id', clientId)
    setSaving(false)
    if (error) {
      setMsg(t('rules.error', { detail: error.message }))
      return
    }
    setUseGlobal(true)
    fillFromGlobals()
    setMsg(t('rules.restored'))
    router.refresh()
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h3 className="font-serif text-lg text-anthracite">{t('rules.title')}</h3>
          <p className="text-xs text-anthracite-lighter mt-1 max-w-prose">{t('rules.description')}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-4 h-4 rounded text-teal"
            checked={useGlobal}
            disabled={saving}
            onChange={(e) => toggleUseGlobal(e.target.checked)}
          />
          {t('rules.useGlobal')}
        </label>
      </div>

      {useGlobal ? (
        <p className="text-sm text-anthracite-lighter mt-3">{t('rules.followsGlobal')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-4">
            {PREDEFINED_ALERT_RULES.map((p) => {
              const d = draft[p.id]
              return (
                <div key={p.id} className="rounded-xl border border-surface-border px-4 py-3 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-anthracite min-w-0">{t(p.titleKey)}</div>
                    <label className="inline-flex items-center gap-1.5 text-xs text-anthracite-lighter cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded text-teal"
                        checked={d.enabled}
                        onChange={(e) => setDraft({ ...draft, [p.id]: { ...d, enabled: e.target.checked } })}
                      />
                      {t('rules.active')}
                    </label>
                  </div>
                  <div className="text-[11px] text-anthracite-lighter mt-1">{t(p.thresholdKey)}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={d.threshold}
                      onChange={(e) => setDraft({ ...draft, [p.id]: { ...d, threshold: Number(e.target.value) } })}
                      className="w-full accent-teal"
                      disabled={!d.enabled}
                    />
                    <span className="text-sm text-anthracite tabular-nums w-16 text-right whitespace-nowrap">
                      {p.step < 1 ? num(d.threshold, 2, locale) : Math.round(d.threshold)}{p.suffix}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-end gap-3 flex-wrap mt-4">
            {msg && <span className="text-sm text-emerald-600">{msg}</span>}
            <button type="button" onClick={restoreGlobals} disabled={saving} className="btn-secondary text-sm inline-flex items-center gap-1.5">
              <RotateCcw size={14} className="flex-shrink-0" /> {t('rules.restore')}
            </button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
              <Save size={14} className="flex-shrink-0" /> {saving ? t('rules.saving') : t('rules.save')}
            </button>
          </div>
        </>
      )}
      {useGlobal && msg && <div className="text-sm text-emerald-600 mt-2">{msg}</div>}
    </section>
  )
}
