export type ChartType = "bar" | "line" | "pie" | "map" | "table" | "none";

export interface ChartPoint {
  label: string;
  value: number;
}

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  count: number;
  intensity: "low" | "medium" | "high";
  district?: string;
}

export interface TableData {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface KPICard {
  label: string;
  value: string;
  change?: string;
}

export interface OrchestratorResponse {
  answer: string;
  chart_type: ChartType;
  chart_data: ChartPoint[] | null;
  map_points: MapPoint[] | null;
  table_data: TableData | null;
  kpis: KPICard[] | null;
  follow_up_suggestions: string[];
  data_range: string;
  query_text: string;
  cached: boolean;
}

export interface OrchestratorRequest {
  audio_base64?: string;
  audio_mime_type?: string;
  text?: string;
  user_id?: string;
  role?: string;
}

export interface QueryPreset {
  title: string;
  query: string;
  hint: string;
  tag: string;
}

export interface HistoryEntry {
  id: string;
  query: string;
  answer: string;
  cached: boolean;
  chart_type: ChartType;
  timestamp: string;
}
