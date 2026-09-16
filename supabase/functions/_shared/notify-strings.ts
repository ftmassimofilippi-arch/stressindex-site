// =============================================================================
// Testi delle email di notifica — IT / EN / DE
// =============================================================================
//
// Unico posto in cui vivono le frasi mandate ai professionisti: le usano sia
// notify-measurement (email immediata) sia notify-digest (riepilogo del
// giorno). Per cambiare una frase si cambia qui e si ri-deploya, non serve
// toccare nient'altro.
//
// REGISTRO — linguaggio wellness, mai clinico. Si parla di "cliente" (mai
// paziente), di "percorso" e di "benessere"; niente diagnosi, niente "valori
// patologici", niente consigli medici. I punteggi si mostrano come numeri su
// 100 con l'etichetta che il cliente vede già nell'app.
//
// I segnaposto sono {nome}: li sostituisce fill() più in basso.

export type Lang = 'it' | 'en' | 'de'
export const LANGS: Lang[] = ['it', 'en', 'de']

export function asLang(v: unknown): Lang {
  return LANGS.includes(v as Lang) ? (v as Lang) : 'it'
}

export const NOTIFY_STRINGS: Record<Lang, Record<string, string>> = {
  it: {
    // ── Oggetto ──────────────────────────────────────────────────────────────
    subject_measurement: '{cliente} ha fatto una misurazione',
    subject_monitoring: '{cliente} ha completato un monitoraggio',
    subject_night: '{cliente} ha registrato una notte',
    subject_multi: '{cliente}: {n} nuove registrazioni',
    subject_digest: 'Riepilogo del giorno · {n} registrazioni',
    subject_digest_one: 'Riepilogo del giorno · 1 registrazione',

    // ── Corpo ────────────────────────────────────────────────────────────────
    greeting_named: 'Ciao {nome},',
    greeting: 'Ciao,',
    intro_single: '{cliente} ha appena registrato una misurazione dalla propria app.',
    intro_multi: '{cliente} ha registrato {n} nuove misurazioni dalla propria app.',
    intro_digest: 'Ecco cosa hanno registrato i tuoi clienti oggi.',
    intro_digest_clients: 'Ecco cosa hanno registrato oggi {m} dei tuoi clienti.',

    label_when: 'Quando',
    label_type: 'Tipo',
    label_duration: 'Durata',
    label_scores: 'Punteggi',
    label_night_hr: 'Battito medio della notte',
    label_night_recovery: 'Recupero notturno',
    label_sleep_duration: 'Durata del sonno',

    score_stress: 'Stress',
    score_recupero: 'Recupero',
    score_equilibrio: 'Equilibrio',
    score_energia: 'Energia',
    score_composito: 'Indice complessivo',

    type_standard: 'Misurazione standard',
    type_orthostatic: 'Test ortostatico',
    type_coherence: 'Respirazione guidata',
    type_incremental: 'Test incrementale',
    type_threshold: 'Test di soglia',
    type_measurement: 'Misurazione',
    type_monitoring_24h: 'Monitoraggio 24 ore',
    type_monitoring_sleep: 'Registrazione del sonno',
    type_monitoring_custom: 'Registrazione lunga',
    type_night: 'Notte',

    no_scores: 'I punteggi compaiono nella scheda appena l\'app finisce di elaborarli.',
    cta_detail: 'Apri il dettaglio',
    cta_client: 'Apri la scheda del cliente',
    cta_dashboard: 'Vai alla tua area',
    duration_minutes: '{n} min',

    footer_why_now: 'Ricevi questa email perché hai scelto di essere avvisato subito quando un cliente collegato si misura.',
    footer_why_digest: 'Ricevi questa email perché hai scelto un riepilogo giornaliero delle misurazioni dei tuoi clienti.',
    footer_change: 'Cambia le preferenze di notifica',
    footer_signature: 'Stress Index',
  },

  en: {
    subject_measurement: '{cliente} took a measurement',
    subject_monitoring: '{cliente} completed a monitoring session',
    subject_night: '{cliente} recorded a night',
    subject_multi: '{cliente}: {n} new recordings',
    subject_digest: 'Today\'s summary · {n} recordings',
    subject_digest_one: 'Today\'s summary · 1 recording',

    greeting_named: 'Hi {nome},',
    greeting: 'Hi,',
    intro_single: '{cliente} has just recorded a measurement from their own app.',
    intro_multi: '{cliente} has recorded {n} new measurements from their own app.',
    intro_digest: 'Here is what your clients recorded today.',
    intro_digest_clients: 'Here is what {m} of your clients recorded today.',

    label_when: 'When',
    label_type: 'Type',
    label_duration: 'Duration',
    label_scores: 'Scores',
    label_night_hr: 'Average heart rate at night',
    label_night_recovery: 'Night recovery',
    label_sleep_duration: 'Sleep duration',

    score_stress: 'Stress',
    score_recupero: 'Recovery',
    score_equilibrio: 'Balance',
    score_energia: 'Energy',
    score_composito: 'Overall index',

    type_standard: 'Standard measurement',
    type_orthostatic: 'Orthostatic test',
    type_coherence: 'Guided breathing',
    type_incremental: 'Incremental test',
    type_threshold: 'Threshold test',
    type_measurement: 'Measurement',
    type_monitoring_24h: '24-hour monitoring',
    type_monitoring_sleep: 'Sleep recording',
    type_monitoring_custom: 'Long recording',
    type_night: 'Night',

    no_scores: 'Scores appear in the client record as soon as the app finishes processing them.',
    cta_detail: 'Open the details',
    cta_client: 'Open the client record',
    cta_dashboard: 'Go to your area',
    duration_minutes: '{n} min',

    footer_why_now: 'You are receiving this email because you chose to be notified as soon as a linked client takes a measurement.',
    footer_why_digest: 'You are receiving this email because you chose a daily summary of your clients\' measurements.',
    footer_change: 'Change your notification preferences',
    footer_signature: 'Stress Index',
  },

  de: {
    subject_measurement: '{cliente} hat eine Messung durchgeführt',
    subject_monitoring: '{cliente} hat eine Aufzeichnung abgeschlossen',
    subject_night: '{cliente} hat eine Nacht aufgezeichnet',
    subject_multi: '{cliente}: {n} neue Aufzeichnungen',
    subject_digest: 'Tagesübersicht · {n} Aufzeichnungen',
    subject_digest_one: 'Tagesübersicht · 1 Aufzeichnung',

    greeting_named: 'Hallo {nome},',
    greeting: 'Hallo,',
    intro_single: '{cliente} hat gerade eine Messung in der eigenen App aufgezeichnet.',
    intro_multi: '{cliente} hat {n} neue Messungen in der eigenen App aufgezeichnet.',
    intro_digest: 'Das haben Ihre Klientinnen und Klienten heute aufgezeichnet.',
    intro_digest_clients: 'Das haben heute {m} Ihrer Klientinnen und Klienten aufgezeichnet.',

    label_when: 'Wann',
    label_type: 'Art',
    label_duration: 'Dauer',
    label_scores: 'Werte',
    label_night_hr: 'Durchschnittlicher Puls in der Nacht',
    label_night_recovery: 'Nächtliche Erholung',
    label_sleep_duration: 'Schlafdauer',

    score_stress: 'Stress',
    score_recupero: 'Erholung',
    score_equilibrio: 'Balance',
    score_energia: 'Energie',
    score_composito: 'Gesamtindex',

    type_standard: 'Standardmessung',
    type_orthostatic: 'Orthostatischer Test',
    type_coherence: 'Geführte Atmung',
    type_incremental: 'Stufentest',
    type_threshold: 'Schwellentest',
    type_measurement: 'Messung',
    type_monitoring_24h: '24-Stunden-Aufzeichnung',
    type_monitoring_sleep: 'Schlafaufzeichnung',
    type_monitoring_custom: 'Lange Aufzeichnung',
    type_night: 'Nacht',

    no_scores: 'Die Werte erscheinen in der Klientenakte, sobald die App sie fertig berechnet hat.',
    cta_detail: 'Details öffnen',
    cta_client: 'Klientenakte öffnen',
    cta_dashboard: 'Zu Ihrem Bereich',
    duration_minutes: '{n} Min.',

    footer_why_now: 'Sie erhalten diese E-Mail, weil Sie sich sofort benachrichtigen lassen, wenn eine verknüpfte Person eine Messung durchführt.',
    footer_why_digest: 'Sie erhalten diese E-Mail, weil Sie eine tägliche Übersicht der Messungen Ihrer Klientinnen und Klienten gewählt haben.',
    footer_change: 'Benachrichtigungen ändern',
    footer_signature: 'Stress Index',
  },
}

/** Testo tradotto con i segnaposto {nome} sostituiti. Chiave sconosciuta → la chiave stessa. */
export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const raw = NOTIFY_STRINGS[lang]?.[key] ?? NOTIFY_STRINGS.it[key] ?? key
  return raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

/** Locale per la formattazione di date e numeri. */
export const LOCALE: Record<Lang, string> = {
  it: 'it-IT',
  en: 'en-GB',
  de: 'de-DE',
}
