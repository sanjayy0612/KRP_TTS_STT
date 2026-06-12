// ============================================================
// shared/types/index.ts
// All shared TypeScript interfaces for KSP Datathon backend
// ============================================================

// ── Database Row Types ────────────────────────────────────────

export interface Zone {
  ROWID:       number;
  name:        string;
  description: string | null;
}

export interface District {
  ROWID:   number;
  name:    string;
  zone_id: number;
  lat:     number;
  lng:     number;
}

export interface Station {
  ROWID:              number;
  name:               string;
  station_code:       string;
  district_id:        number;
  address:            string | null;
  lat:                number;
  lng:                number;
  phone:              string | null;
  officer_in_charge:  string | null;
}

export type FIRStatus =
  | "OPEN"
  | "UNDER_INVESTIGATION"
  | "CHARGESHEETED"
  | "CLOSED"
  | "ACQUITTED";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CrimeCategory {
  ROWID:     number;
  code:      string;
  name:      string;
  parent_id: number | null;
  severity:  Severity;
}

export interface FIR {
  ROWID:             number;
  fir_number:        string;
  station_id:        number;
  category_id:       number;
  ipc_sections:      string;
  date_filed:        string;
  incident_date:     string | null;
  incident_lat:      number | null;
  incident_lng:      number | null;
  incident_area:     string | null;
  description:       string | null;
  status:            FIRStatus;
  assigned_officer:  string | null;
}

export type ArrestStatus =
  | "AT_LARGE"
  | "ARRESTED"
  | "BAILED"
  | "CONVICTED"
  | "ACQUITTED";

export interface Accused {
  ROWID:          number;
  fir_id:         number;
  name:           string;
  alias:          string | null;
  age:            number | null;
  gender:         "MALE" | "FEMALE" | "OTHER" | null;
  occupation:     string | null;
  address:        string | null;
  district_id:    number | null;
  arrest_status:  ArrestStatus;
  arrest_date:    string | null;
}

export type InjuryType = "NONE" | "MINOR" | "GRIEVOUS" | "FATAL";

export interface Victim {
  ROWID:       number;
  fir_id:      number;
  name:        string | null;
  age:         number | null;
  gender:      "MALE" | "FEMALE" | "OTHER" | null;
  injury_type: InjuryType;
  address:     string | null;
}

// ── Tool Parameter Types ──────────────────────────────────────

export interface SearchFIRParams {
  district?:     string;
  station_name?: string;
  date_from?:    string;
  date_to?:      string;
  status?:       FIRStatus;
  limit?:        number;
}

export interface CrimeByTypeParams {
  ipc_section?:   string;
  category_code?: string;
  district?:      string;
  date_from?:     string;
  date_to?:       string;
  limit?:         number;
}

export type TimeRange = "7d" | "30d" | "90d" | "1y" | "all";
export type GroupBy   = "station" | "district";

export interface HotspotParams {
  district?:      string;
  category_code?: string;
  time_range:     TimeRange;
  group_by?:      GroupBy;
}

export type TrendMetric     = "total_firs" | "arrests" | "resolution_rate" | "open_cases";
export type TrendGranularity = "daily" | "weekly" | "monthly" | "yearly";

export interface TrendParams {
  metric:        TrendMetric;
  granularity:   TrendGranularity;
  date_from?:    string;
  date_to?:      string;
  district?:     string;
  category_code?: string;
}

export interface AccusedLookupParams {
  name?:          string;
  arrest_status?: ArrestStatus;
  district?:      string;
  fir_id?:        number;
  limit?:         number;
}

export interface StationStatsParams {
  station_name?: string;
  station_id?:   number;
  date_from?:    string;
  date_to?:      string;
}

export interface SummaryStatsParams {
  district?:  string;
  date_from?: string;
  date_to?:   string;
}

// ── Tool Result Types ─────────────────────────────────────────

export interface FIRRow {
  id:               number;
  fir_number:       string;
  date_filed:       string;
  incident_date:    string | null;
  ipc_sections:     string;
  status:           FIRStatus;
  incident_area:    string | null;
  lat:              number | null;
  lng:              number | null;
  assigned_officer: string | null;
  station_name:     string;
  station_code:     string;
  district:         string;
  crime_category:   string;
  severity:         Severity;
}

export interface CategoryBreakdown {
  category:  string;
  severity:  Severity;
  count:     number;
  resolved:  number;
}

export interface HotspotPoint {
  station_id?:      number;
  district_id?:     number;
  label:            string;
  lat:              number;
  lng:              number;
  district?:        string;
  total_crimes:     number;
  open_cases:       number;
  resolved:         number;
  resolution_rate:  number;
  intensity:        "low" | "medium" | "high";
}

export interface TrendPoint {
  period: string;
  value:  number;
}

export interface TrendSummary {
  total:   number;
  avg:     number;
  max:     number;
  min:     number;
  periods: number;
}

export interface AccusedRow {
  id:             number;
  name:           string;
  alias:          string | null;
  age:            number | null;
  gender:         string | null;
  occupation:     string | null;
  address:        string | null;
  arrest_status:  ArrestStatus;
  arrest_date:    string | null;
  fir_number:     string;
  date_filed:     string;
  ipc_sections:   string;
  fir_status:     FIRStatus;
  crime_category: string;
  severity:       Severity;
  station_name:   string;
  district:       string;
}

export interface RepeatOffender {
  name:         string;
  alias:        string | null;
  age:          number | null;
  gender:       string | null;
  fir_count:    number;
  arrest_status: ArrestStatus;
  crime_types:  string;
  last_incident: string;
}

export interface StationStat {
  station_id:         number;
  station_name:       string;
  station_code:       string;
  lat:                number;
  lng:                number;
  officer_in_charge:  string | null;
  district:           string;
  total_firs:         number;
  open_cases:         number;
  under_investigation: number;
  chargesheeted:      number;
  closed:             number;
  resolution_rate:    number;
}

export interface KPISummary {
  total_firs:          number;
  open_cases:          number;
  under_investigation: number;
  resolved:            number;
  resolution_rate:     number;
  active_stations:     number;
  critical_crimes:     number;
  high_crimes:         number;
}

export interface ArrestSummary {
  total_accused: number;
  arrested:      number;
  at_large:      number;
  convicted:     number;
  bailed:        number;
  arrest_rate:   number;
}

export interface WeeklyComparison {
  this_week: number;
  last_week: number;
  delta_pct: number;
  trend:     "up" | "down" | "stable";
}

// ── Orchestrator Types ────────────────────────────────────────

export type ChartType = "bar" | "line" | "pie" | "map" | "table" | "none";

export interface ChartPoint {
  label: string;
  value: number;
}

export interface MapPoint {
  lat:       number;
  lng:       number;
  label:     string;
  count:     number;
  intensity: "low" | "medium" | "high";
}

export interface TableData {
  columns: string[];
  rows:    (string | number | null)[][];
}

export interface KPICard {
  label:  string;
  value:  string;
  change?: string;
}

export interface OrchestratorResponse {
  answer:                string;
  chart_type:            ChartType;
  chart_data:            ChartPoint[]   | null;
  map_points:            MapPoint[]     | null;
  table_data:            TableData      | null;
  kpis:                  KPICard[]      | null;
  follow_up_suggestions: string[];
  data_range:            string;
  query_text:            string;
  cached:                boolean;
}

export interface OrchestratorRequest {
  audio_base64?:   string;
  audio_mime_type?: string;
  text?:           string;
  user_id?:        string;
  role?:           string;
}

// ── LLM Types ─────────────────────────────────────────────────

export interface LLMToolCall {
  id:       string;
  type:     "function";
  function: {
    name:      string;
    arguments: string;
  };
}

export interface LLMMessage {
  role:        "system" | "user" | "assistant" | "tool";
  content:     string;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
}

export interface LLMResponse {
  content:     string;
  tool_calls?: LLMToolCall[];
}
