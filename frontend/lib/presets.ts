import type { QueryPreset } from "./types";

export const QUERY_PRESETS: QueryPreset[] = [
  {
    title: "Statewide dashboard",
    query: "Show the Karnataka-wide crime summary for the latest available period and highlight the biggest risks.",
    hint: "Best for opening the dashboard with KPIs, weekly comparison, and top categories.",
    tag: "Summary",
  },
  {
    title: "Hotspot map",
    query: "Which police stations are the biggest crime hotspots in Bengaluru Urban over the last 90 days?",
    hint: "Best for map output and station-level hotspot analysis.",
    tag: "Map",
  },
  {
    title: "FIR search",
    query: "Find recent open FIRs in Mysuru district between 2025-01-01 and 2025-03-31.",
    hint: "Best for filtering FIRs by district, status, and date range.",
    tag: "Search",
  },
  {
    title: "Trend analysis",
    query: "Show the monthly trend of total FIRs in Karnataka for the last year.",
    hint: "Best for line charts and time-series comparisons.",
    tag: "Trend",
  },
  {
    title: "Accused lookup",
    query: "Look up accused persons with arrest status ARRESTED in Bengaluru Urban.",
    hint: "Best for suspect records and repeat offender investigation.",
    tag: "People",
  },
  {
    title: "Crime by type",
    query: "Break down robbery and theft cases in Hubballi-Dharwad for the last 30 days.",
    hint: "Best for category summaries and tabular results.",
    tag: "Category",
  },
];

export const QUICK_HINTS = [
  {
    title: "Text or voice",
    detail: "Send plain-language prompts or upload an audio clip for transcription and analysis.",
  },
  {
    title: "Structured output",
    detail: "The orchestrator returns charts, maps, tables, KPIs, and follow-up suggestions in one payload.",
  },
  {
    title: "Cache aware",
    detail: "Repeated questions can be served from cache, which is surfaced in the UI.",
  },
];
