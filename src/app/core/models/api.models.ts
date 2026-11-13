// Wire contracts shared with the FastAPI backend (JSON in camelCase).

export type ChartType =
  | 'line' | 'bar' | 'pie' | 'heatmap' | 'sankey' | 'funnel' | 'gauge' | 'boxplot' | 'table';

export interface SeriesDef {
  dataKey: string;
  label: string;
}

/** One chart contract for dashboard blocks AND /ask answers. */
export interface VisualizationSpec {
  chartType: ChartType;
  title: string;
  /** Category axis key (month, department, payer...). */
  xKey?: string;
  /** Optional second dimension in long-format data (e.g. department per month). */
  seriesKey?: string;
  series: SeriesDef[];
  data: Record<string, string | number | null>[];
  options?: {
    orientation?: 'vertical' | 'horizontal';
    unit?: string;
    target?: number;
    max?: number;
    /** Bars above this value are drawn in the alert colour. */
    highlightAbove?: number;
    area?: boolean;
    markPeak?: boolean;
  };
}

export interface DashboardFilters {
  hospitalIds: string[]; // empty = all hospitals in the user's scope
  from: string;          // ISO yyyy-mm-dd
  to: string;
}

export interface FilterOptions {
  hospitals: { id: string; name: string }[];
  departments: string[];
  payers: string[];
  dataFrom: string;
  dataTo: string;
}

export interface Kpi {
  key: string;
  label: string;
  value: number;
  display: string;
  change: { label: string; direction: 'up' | 'down'; favourable: boolean };
  sparkline: number[];
}

export interface SummaryResponse {
  period: { from: string; to: string };
  comparisonLabel: string;
  kpis: Kpi[];
}

export type Granularity = 'month' | 'week';

export interface AdmissionsResponse {
  granularity: Granularity;
  trend: VisualizationSpec;
  byDepartment: VisualizationSpec;
  byHospital: VisualizationSpec;
  heatmap: VisualizationSpec;
  losDistribution: VisualizationSpec;
}

export interface ClaimsResponse {
  denialByPayer: VisualizationSpec;
  outcomes: VisualizationSpec;     // sankey payer -> status
  denialGauge: VisualizationSpec;
  totals: { claims: number; denied: number; pending: number; denialRate: number; target: number };
  topDenier?: { payer: string; shareOfDenied: number; shareOfVolume: number };
}

export interface PendingClaim {
  claimId: string;
  hospital: string;
  department: string;
  payer: string;
  amount: number;
  daysPending: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export type AskStatus = 'success' | 'no_data' | 'clarify' | 'unsupported' | 'forbidden' | 'error';

export interface AskRequest {
  question: string;
  filters?: Partial<DashboardFilters>;
  conversationId?: string | null;
}

export interface AskResponse {
  status: AskStatus;
  message?: string;
  metric?: string;
  metricLabel?: string;
  reportingPeriod?: { from: string; to: string };
  appliedFilters?: Record<string, string>;
  chart?: VisualizationSpec;
  facts?: Record<string, string | number>;
  insight?: string;
  executionTimeMs?: number;
  conversationId: string;
  referenceId?: string;
}

export type HistoryStatus = 'answered' | 'no_data' | 'clarified' | 'blocked';

export interface HistoryItem {
  id: string;
  askedAt: string; // ISO timestamp
  question: string;
  metricLabel: string | null;
  scopeLabel: string;
  status: HistoryStatus;
  rowCount: number | null;
  durationMs: number;
  conversationId: string;
  parentId?: string | null;
}

export interface HistoryQuery {
  q?: string;
  status?: HistoryStatus | '';
  page?: number;
  size?: number;
}

export interface HistoryListResponse extends Page<HistoryItem> {
  summary: { asked: number; answered: number; clarifiedOrNoData: number; blocked: number };
}

export interface HistoryDetail {
  item: HistoryItem;
  parentQuestion?: string | null;
  plan: { label: string; value: string }[];
  result: AskResponse;
}
