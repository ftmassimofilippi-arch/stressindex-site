// Tipi condivisi del database Stress Index
// Allineato allo schema Supabase esistente + estensioni dashboard

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
  // NB: clients.id è TEXT nel DB (non UUID), ma teniamo string per compatibilità del tipo
  id: UUID
  // Colonna del DB esistente: professionista_id (italiano), non professional_id
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

export interface Session {
  id: UUID
  client_id: UUID
  professional_id?: UUID
  created_at: string
  duration_seconds?: number | null

  // Score proprietari (0–100)
  stress_score?: number | null
  recovery_score?: number | null
  balance_score?: number | null
  energy_score?: number | null
  inflammatory_modulation?: number | null

  // Time domain
  mean_rr?: number | null
  sdnn?: number | null
  rmssd?: number | null
  pnn50?: number | null
  cv?: number | null
  bpm_mean?: number | null

  // Frequency domain
  vlf?: number | null
  lf?: number | null
  hf?: number | null
  lf_hf_ratio?: number | null
  total_power?: number | null
  lf_nu?: number | null
  hf_nu?: number | null

  // Non-linear
  sd1?: number | null
  sd2?: number | null
  sd1_sd2_ratio?: number | null
  dfa_alpha1?: number | null
  dfa_alpha2?: number | null
  sample_entropy?: number | null
  approx_entropy?: number | null

  // Geometric
  hrv_triangular_index?: number | null
  tinn?: number | null

  signal_quality?: number | null
  sensor_used?: string | null
  rr_intervals?: number[] | null
  notes?: string | null
}

export interface Alert {
  id: UUID
  professional_id: UUID
  client_id: UUID
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
  client_id: UUID
  expected_frequency_per_week: number
  alert_threshold_stress: number
  alert_threshold_recovery: number
  alert_threshold_balance: number
  alert_threshold_energy: number
  tags: string[]
  assigned_protocol_id?: UUID | null
  last_measurement_at?: string | null
}

export interface ClientNote {
  id: UUID
  professional_id: UUID
  client_id: UUID
  session_id?: UUID | null
  content: string
  tags: string[]
  attachments_urls: string[]
  created_at: string
  updated_at?: string
}

export interface Message {
  id: UUID
  professional_id: UUID
  client_id: UUID
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
  client_id: UUID
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
  stress_score: 'Stress',
  recovery_score: 'Recupero',
  balance_score: 'Equilibrio',
  energy_score: 'Energia',
} as const
