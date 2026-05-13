// Tipi condivisi del database Stress Index
// Allineato allo schema Supabase reale (legacy app Flutter + estensioni dashboard)
// Le colonne in italiano sono volute: rispecchiano le colonne fisiche su DB.

export type UUID = string

export interface ProfessionalProfile {
  id: UUID
  titolo?: string | null
  nome?: string | null
  cognome?: string | null
  professione?: string | null
  specializzazione?: string | null
  nome_studio?: string | null
  indirizzo?: string | null
  telefono?: string | null
  sito_web?: string | null
  logo_url?: string | null
  trial_expires_at?: string | null
  created_at?: string
}

export interface Client {
  // clients.id è TEXT nel DB (non UUID), ma teniamo string per il tipo
  id: string
  // Colonna del DB: professionista_id (italiano), non professional_id
  professionista_id: UUID
  nome: string | null
  cognome: string | null
  email?: string | null
  telefono?: string | null
  data_nascita?: string | null
  sesso?: 'M' | 'F' | 'X' | null
  peso?: number | null
  altezza?: number | null
  fumatore?: boolean | null
  atleta?: boolean | null
  livello_attivita?: string | null
  last_measurement_at?: string | null
  created_at?: string
  avatar_url?: string | null
  note?: string | null
}

// Tabella sessions: solo record raw della misurazione.
// Gli score proprietari e i parametri HRV calcolati sono in measurement_analytics.
export interface Session {
  id: string
  professionista_id: UUID
  client_id: string
  client_nome: string | null
  started_at: string
  duration_seconds: number
  sample_count: number
  hrv_data: unknown | null
  created_at: string
  notes_professionista: string | null
  indicazioni: string | null
  tags: string[]
  test_type: string | null
}

// Tabella measurement_analytics: contiene tutti gli score proprietari
// e i 24+ parametri HRV in colonne separate. Fonte autoritativa per la dashboard.
export interface MeasurementAnalytics {
  id: UUID
  session_id: string // FK → sessions.id
  user_id: UUID // = auth.uid() del professionista (RLS)
  client_id: string
  measured_at: string
  duration_seconds: number
  sensor_type: string | null
  sensor_name: string | null

  age: number | null
  sex: 'M' | 'F' | 'X' | null
  is_smoker: boolean | null
  is_athlete: boolean | null
  activity_level: string | null

  rr_intervals: number[] | null
  rr_count: number | null
  artifact_percentage: number | null

  // Time domain
  mean_rr: number | null
  sdnn: number | null
  rmssd: number | null
  pnn50: number | null
  pnn20: number | null
  mean_hr: number | null
  sdnn_index: number | null
  cv: number | null
  rmssd_sdnn_ratio: number | null

  // Frequency domain (Welch)
  vlf_power: number | null
  lf_power: number | null
  hf_power: number | null
  total_power: number | null
  lf_hf_ratio: number | null
  lf_nu: number | null
  hf_nu: number | null
  lf_vlf_ratio: number | null

  // Frequency Lomb-Scargle
  vlf_power_ls: number | null
  lf_power_ls: number | null
  hf_power_ls: number | null
  total_power_ls: number | null
  lf_hf_ratio_ls: number | null

  // Non-linear
  sd1: number | null
  sd2: number | null
  sd1_sd2_ratio: number | null
  dfa_alpha1: number | null
  dfa_alpha2: number | null
  sample_entropy: number | null
  approximate_entropy: number | null

  // Geometric
  triangular_index: number | null
  tinn: number | null

  // Baevsky
  stress_index_baevsky: number | null

  // Score proprietari (0–100)
  score_stress: number | null
  score_recupero: number | null
  score_equilibrio: number | null
  score_energia: number | null
  score_modulazione_infiammatoria: number | null
  score_composito: number | null

  // Meta
  algorithm_version: string | null
  score_weights: unknown | null
  tags: string[] | null
  created_at: string
  test_type: string | null

  // Future features
  orthostatic_data: unknown | null
  coherence_data: unknown | null
}

// Tipo arricchito con i campi di sessions utili per il dettaglio misurazione
export interface MeasurementWithSession extends MeasurementAnalytics {
  notes_professionista: string | null
  indicazioni: string | null
}

export interface Alert {
  id: UUID
  professional_id: UUID
  client_id: string
  type: 'high_stress' | 'low_recovery' | 'missed_measurement' | 'abnormal_value' | 'trend_negative'
  severity: 'low' | 'medium' | 'high'
  message?: string | null
  triggering_value?: number | null
  triggering_metric?: string | null
  status: 'new' | 'seen' | 'resolved' | 'dismissed'
  created_at: string
  seen_at?: string | null
  resolved_at?: string | null
}

export interface ClientSettings {
  client_id: string
  expected_frequency_per_week: number
  alert_threshold_stress: number
  alert_threshold_recovery: number
  alert_threshold_balance: number
  alert_threshold_energy: number
  tags: string[]
  assigned_protocol_id?: UUID | null
  last_measurement_at?: string | null
}

// Schema reale (italiano): testo, categoria, data_creazione, data_reminder
export interface ClientNote {
  id: string
  professionista_id: UUID
  client_id: string
  testo: string
  categoria: string | null
  data_creazione: string
  data_reminder: string | null
  tags: string[]
  attachments_urls: string[]
}

export interface Message {
  id: UUID
  professional_id: UUID
  client_id: string
  subject?: string | null
  content?: string | null
  channel: 'email' | 'push'
  sent_at: string
  read_at?: string | null
  delivered: boolean
}

export interface NotificationPreferences {
  user_id: UUID
  weekly_summary_email: boolean
  weekly_summary_day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  weekly_summary_time: string
  alert_email_enabled: boolean
  marketing_email_enabled: boolean
}

export interface AiInsight {
  id: UUID
  client_id: string
  summary?: string | null
  recommendations?: string | null
  generated_at?: string | null
  model_used?: string | null
}

// Etichette UI in italiano
export const ALERT_TYPE_LABEL: Record<Alert['type'], string> = {
  high_stress: 'Stress elevato',
  low_recovery: 'Recupero basso',
  missed_measurement: 'Misurazione mancante',
  abnormal_value: 'Valore anomalo',
  trend_negative: 'Trend negativo',
}

export const SCORE_LABEL = {
  score_stress: 'Stress',
  score_recupero: 'Recupero',
  score_equilibrio: 'Equilibrio',
  score_energia: 'Energia',
} as const

export const NOTE_CATEGORIES = [
  'valutazione',
  'follow-up',
  'post-trattamento',
  'anamnesi',
  'altro',
] as const

export type NoteCategory = typeof NOTE_CATEGORIES[number]
