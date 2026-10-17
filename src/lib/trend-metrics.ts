// =============================================================================
// Elenco delle metriche dei grafici di andamento (colonne di measurement_analytics)
// =============================================================================
//
// Modulo puro, senza React: lo importano il grafico (client) e le pagine
// server che devono conoscere le chiavi valide (vista salvata, stampa).
// L'etichetta di ogni metrica è in `charts.metrics.<key>`; i nomi dei gruppi in
// `charts.groups.<group>`; per i pannelli alcune metriche hanno un nome più
// parlante in `charts.panel.names.<key>` ("Variabilità cardiaca (RMSSD)").

export type MetricGroup = 'score' | 'time' | 'welch' | 'lomb' | 'nonlinear' | 'geometric'

export type MetricDef = {
  key: string
  color: string
  group: MetricGroup
  unit?: string
  decimals?: number
}

export const TREND_METRICS: MetricDef[] = [
  // Score proprietari (0-100)
  { key: 'score_stress', color: '#E85D4A', group: 'score', unit: '/100', decimals: 1 },
  { key: 'score_recupero', color: '#4FA39A', group: 'score', unit: '/100', decimals: 1 },
  { key: 'score_equilibrio', color: '#F59E0B', group: 'score', unit: '/100', decimals: 1 },
  { key: 'score_energia', color: '#6366F1', group: 'score', unit: '/100', decimals: 1 },
  { key: 'score_modulazione_infiammatoria', color: '#8B5CF6', group: 'score', unit: '/100', decimals: 1 },
  { key: 'score_composito', color: '#2E746C', group: 'score', unit: '/100', decimals: 1 },

  // Time domain (blu)
  { key: 'sdnn', color: '#0EA5E9', group: 'time', unit: 'ms', decimals: 1 },
  { key: 'rmssd', color: '#0284C7', group: 'time', unit: 'ms', decimals: 1 },
  { key: 'pnn50', color: '#7DD3FC', group: 'time', unit: '%', decimals: 1 },
  { key: 'pnn20', color: '#BAE6FD', group: 'time', unit: '%', decimals: 1 },
  { key: 'mean_hr', color: '#1D4ED8', group: 'time', unit: 'bpm', decimals: 1 },
  { key: 'cv', color: '#0369A1', group: 'time', unit: '', decimals: 2 },
  { key: 'rmssd_sdnn_ratio', color: '#075985', group: 'time', unit: '', decimals: 2 },

  // Frequency Welch (viola)
  { key: 'vlf_power', color: '#A855F7', group: 'welch', unit: 'ms²', decimals: 0 },
  { key: 'lf_power', color: '#C084FC', group: 'welch', unit: 'ms²', decimals: 0 },
  { key: 'hf_power', color: '#D8B4FE', group: 'welch', unit: 'ms²', decimals: 0 },
  { key: 'total_power', color: '#7C3AED', group: 'welch', unit: 'ms²', decimals: 0 },
  { key: 'lf_hf_ratio', color: '#6D28D9', group: 'welch', unit: '', decimals: 2 },
  { key: 'lf_nu', color: '#5B21B6', group: 'welch', unit: 'n.u.', decimals: 1 },
  { key: 'hf_nu', color: '#4C1D95', group: 'welch', unit: 'n.u.', decimals: 1 },

  // Frequency Lomb-Scargle (rosa)
  { key: 'vlf_power_ls', color: '#EC4899', group: 'lomb', unit: 'ms²', decimals: 0 },
  { key: 'lf_power_ls', color: '#F472B6', group: 'lomb', unit: 'ms²', decimals: 0 },
  { key: 'hf_power_ls', color: '#F9A8D4', group: 'lomb', unit: 'ms²', decimals: 0 },
  { key: 'total_power_ls', color: '#DB2777', group: 'lomb', unit: 'ms²', decimals: 0 },
  { key: 'lf_hf_ratio_ls', color: '#BE185D', group: 'lomb', unit: '', decimals: 2 },

  // Non-lineari (arancio)
  { key: 'sd1', color: '#F97316', group: 'nonlinear', unit: 'ms', decimals: 1 },
  { key: 'sd2', color: '#FB923C', group: 'nonlinear', unit: 'ms', decimals: 1 },
  { key: 'sd1_sd2_ratio', color: '#FDBA74', group: 'nonlinear', unit: '', decimals: 2 },
  { key: 'dfa_alpha1', color: '#EA580C', group: 'nonlinear', unit: '', decimals: 2 },
  { key: 'dfa_alpha2', color: '#C2410C', group: 'nonlinear', unit: '', decimals: 2 },
  { key: 'sample_entropy', color: '#9A3412', group: 'nonlinear', unit: '', decimals: 2 },
  { key: 'approximate_entropy', color: '#7C2D12', group: 'nonlinear', unit: '', decimals: 2 },

  // Geometrici (lime)
  { key: 'triangular_index', color: '#84CC16', group: 'geometric', unit: '', decimals: 1 },
  { key: 'tinn', color: '#65A30D', group: 'geometric', unit: 'ms', decimals: 1 },
  { key: 'stress_index_baevsky', color: '#4D7C0F', group: 'geometric', unit: '', decimals: 1 },
]

export const METRIC_MAP: Record<string, MetricDef> = Object.fromEntries(TREND_METRICS.map((m) => [m.key, m]))

export const METRIC_KEYS: ReadonlySet<string> = new Set(TREND_METRICS.map((m) => m.key))

/** Metriche con un nome parlante per i pannelli (`charts.panel.names.<key>`). */
export const PANEL_NAMES: ReadonlySet<string> = new Set(['rmssd', 'sdnn', 'mean_hr'])

export const GROUP_ORDER: MetricGroup[] = ['score', 'time', 'welch', 'lomb', 'nonlinear', 'geometric']
