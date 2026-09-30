import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { PrintShell, PrintSection, PrintKv, professionalLine } from '@/components/print/PrintShell'
import { Monitoring24hDetail } from '@/components/monitoring/Monitoring24hDetail'
import { SleepDetail } from '@/components/monitoring/SleepDetail'
import { resolvePrintAccess } from '@/lib/print-access'
import { getMonitoringSession } from '@/lib/monitoring-data'
import { filterMonitoringByModules, getMyAccountAccess } from '@/lib/account-access'
import { loadOwnerProfile } from '@/lib/report-data'
import { isSleepSession, type MonitoringSession } from '@/lib/monitoring-types'
import type { ProfessionalProfile } from '@/lib/types'
import { fixtureProfessional, fixturesEnabled } from '@/lib/print-fixtures'
import { fixtureMonitoring24hSession, fixtureSleepSession, isMonitoringFixtureKind } from '@/lib/print-fixtures-monitoring'
import type { Lang } from '@/lib/monitoring-strings'
import {
  duration, effectiveProfile, periodLabel, profileLabel, signalQualityLabel, sleepCoverageLabel, typeLabel,
} from '@/lib/monitoring-format'
import { todayLong } from '@/lib/format'

export const dynamic = 'force-dynamic'

// Pagina di stampa del monitoraggio (24h o Sonno): riusa Monitoring24hDetail /
// SleepDetail in modalità `print` (niente azioni, grafici a dimensione fissa,
// tutto espanso). Aperta da Chrome headless dalla route
// /api/pdf/monitoraggio/[id]?variant=pro|client.
//
// `variant=client` è il report per il cliente: stesse semplificazioni della
// dashboard cliente e del PDF legacy (nomi semplici, niente sigle non
// spiegate, niente "Come si calcola", Mappa delle ore, Ritmo e Parametri).
//
// Solo la via con sessione (cookie) è supportata: getMonitoringSession legge
// con la sessione utente (RLS) e con il ponte service_role del professionista
// loggato, quindi la via "solo token" non ha un client da cui leggere.
// Fuori produzione (o con PDF_FIXTURES=true) `?fixture=sleep|24h` mostra dati
// di simulazione senza sessione, per verificare i layout.
async function loadForPrint(id: string, lang: Lang, searchParams?: { token?: string; fixture?: string }): Promise<{ session: MonitoringSession; professional: ProfessionalProfile | null }> {
  if (fixturesEnabled() && isMonitoringFixtureKind(searchParams?.fixture)) {
    return {
      session: searchParams!.fixture === 'sleep' ? fixtureSleepSession(lang) : fixtureMonitoring24hSession(lang),
      professional: fixtureProfessional(),
    }
  }
  const access = await resolvePrintAccess(searchParams?.token, { kind: 'monitoring', id })
  if (!access.ok || access.viaToken) notFound()
  const { supabase, userId } = access

  const session = await getMonitoringSession(id, userId)
  if (!session) notFound()
  if (filterMonitoringByModules([session], await getMyAccountAccess()).length === 0) notFound()

  const ownerId = session.professionista_id ?? userId
  return { session, professional: await loadOwnerProfile(supabase, ownerId) }
}

export default async function PrintMonitoringPage({
  params,
  searchParams,
}: {
  params: { locale: string; id: string }
  searchParams?: { token?: string; variant?: string; fixture?: string }
}) {
  const locale = await getLocale()
  // `const` (non `let`): il tipo discriminato si restringe con isSleepSession più sotto.
  const { session, professional } = await loadForPrint(params.id, locale as Lang, searchParams)

  const t = await getTranslations('print')
  const tMon = await getTranslations('monitoring')
  const tPdf = await getTranslations('pdf.common')

  const pro = searchParams?.variant !== 'client'
  const sleep = isSleepSession(session)
  const tz = session.tz_offset_minutes
  const clientName = session.client_name ?? tMon('client')
  const type = typeLabel(session.monitoring_type, tMon)
  const proLine = professionalLine(professional)

  // Periodo e durata: per il Sonno la notte analizzata, se presente.
  const startIso = sleep ? session.night?.night_start ?? session.start_time : session.start_time
  const endIso = sleep ? session.night?.night_end ?? session.end_time : session.end_time
  const durMin = sleep ? session.night?.duration_minutes ?? session.duration_minutes : session.duration_minutes
  const period = periodLabel(startIso, endIso, tz, locale)

  let profile: string | null = null
  let signal: string
  let device: string
  if (sleep) {
    const sig = session.night?.sleep?.signal ?? null
    signal = [sleepCoverageLabel(sig?.coverage_label ?? null, locale, tMon), sig ? tMon('sleep.validData', { pct: Math.round(sig.coverage_pct) }) : null].filter(Boolean).join(' · ')
    device = `${session.device_name ?? 'Checkme O2 Max'}${session.device_serial ? ` · ${tMon('sleep.serial', { serial: session.device_serial })}` : ''}`
  } else {
    const p = effectiveProfile(session)
    profile = `${profileLabel(p.profile, locale)}${p.estimated ? ` * (${t('monitoring.estimated')})` : ''}`
    const cov = session.valid_coverage_percentage
    signal = [signalQualityLabel(session.signal_quality, tMon), cov != null ? tMon('validDataPct', { pct: Math.round(cov) }) : null].filter(Boolean).join(' · ')
    device = session.device_name ?? '—'
  }

  return (
    <PrintShell clientLine={clientName} dateLine={`${period} · ${type}`} professional={professional}>
      {/* 1. Copertina compatta */}
      <section className="print-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[24px] leading-tight text-anthracite">{sleep ? t('monitoring.titleSleep') : t('monitoring.title24h')}</h1>
            <p className="text-[11px] text-anthracite-lighter mt-1">{t('monitoring.subtitle')}</p>
          </div>
          {!pro && (
            <span className="px-2.5 py-1 rounded-full bg-teal-light text-teal-dark text-[10px] font-semibold whitespace-nowrap">{t('monitoring.clientVariant')}</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-x-4 gap-y-3 mt-4">
          <PrintKv label={t('cover.client')} value={clientName || tPdf('clientFallback')} />
          <PrintKv label={t('cover.period')} value={period} />
          <PrintKv label={t('cover.duration')} value={duration(durMin)} />
          <PrintKv label={t('monitoring.type')} value={type} />
          {profile && <PrintKv label={t('monitoring.profile')} value={profile} />}
          <PrintKv label={t('cover.signalQuality')} value={signal || '—'} />
          <PrintKv label={t('monitoring.device')} value={device} />
          {proLine.length > 0 && (
            <div className={profile ? 'col-span-1' : 'col-span-2'}>
              <PrintKv label={t('cover.professional')} value={proLine.slice(0, 3).join(' · ')} />
            </div>
          )}
        </div>
      </section>

      {/* 2. Le stesse sezioni della dashboard (senza salti pagina forzati: le card si accodano) */}
      <div className="mt-6">
        {sleep ? (
          <SleepDetail session={session} readOnly print pro={pro} />
        ) : (
          <Monitoring24hDetail session={session} readOnly print pro={pro} />
        )}
      </div>

      {/* 3. Disclaimer completo */}
      <PrintSection title={t('disclaimer.title')} avoid>
        <div className="print-card p-4 text-[10px] leading-relaxed text-anthracite-light space-y-2">
          <p>{tPdf('disclaimerPart1')}</p>
          <p>{tPdf('disclaimerPart2')}</p>
          <p className="text-anthracite-lighter">{t('disclaimer.generated', { site: 'stressindex.io', date: todayLong(locale) })}</p>
        </div>
      </PrintSection>
    </PrintShell>
  )
}
