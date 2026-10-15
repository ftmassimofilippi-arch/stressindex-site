import { getTranslations } from 'next-intl/server'
import { Globe } from 'lucide-react'
import { MetricCard } from './MetricCard'
import { getPlatformCounts } from '@/lib/admin-counts'

// Vista globale del superadmin (data-scope.ts): conteggi di piattaforma al
// posto delle righe. Ogni pagina dell'area che in modalità "all" non ha nulla
// di suo da mostrare rende questo pannello. Da qui non esce nessun nome.
export async function GlobalScopePanel({ compact = false }: { compact?: boolean }) {
  const t = await getTranslations('dashboard.scope')
  const counts = await getPlatformCounts()
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-rose-50 border border-rose-200">
        <Globe size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="text-xs font-bold tracking-wider text-rose-700">{t('badge')}</div>
          <p className="text-sm text-rose-900 mt-0.5">{t('note')}</p>
        </div>
      </div>
      {!counts ? (
        <div className="card p-6 text-sm text-anthracite-lighter">{t('unavailable')}</div>
      ) : (
        <div className={`grid grid-cols-2 ${compact ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3`}>
          <MetricCard label={t('counts.professionisti')} value={counts.professionisti} hint={t('counts.professionistiOggi') + ': ' + counts.professionistiAttiviOggi} />
          <MetricCard label={t('counts.schede')} value={counts.schede} hint={t('counts.schedeAttive90') + ': ' + counts.schedeAttive90} />
          <MetricCard label={t('counts.collegamenti')} value={counts.collegamentiAttivi} />
          <MetricCard label={t('counts.misurazioni')} value={counts.misurazioni} hint={t('counts.misurazioni30') + ': ' + counts.misurazioni30} />
          <MetricCard label={t('counts.misurazioniOggi')} value={counts.misurazioniOggi} hint={`${counts.misurazioniOggiInStudio} ${t('counts.inStudio')} · ${counts.misurazioniOggiDaRemoto} ${t('counts.daRemoto')}`} />
          <MetricCard label={t('counts.alertAttivi')} value={counts.alertAttivi} hint={t('counts.alertRisolti7') + ': ' + counts.alertRisolti7} />
          <MetricCard label={t('counts.monitoraggi')} value={counts.monitoraggi} hint={t('counts.monitoraggi30') + ': ' + counts.monitoraggi30} />
        </div>
      )}
    </section>
  )
}
