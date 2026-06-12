// ============================================================
// shared/tools.ts
// LLM Tool definitions — fully typed
// ============================================================

export interface ToolParameterProperty {
  type:        string;
  description: string;
  enum?:       string[];
}

export interface ToolParameters {
  type:       "object";
  properties: Record<string, ToolParameterProperty>;
  required:   string[];
}

export interface ToolDefinition {
  name:        string;
  description: string;
  parameters:  ToolParameters;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "fn_search_fir",
    description: `Search and filter FIRs (First Information Reports) from the KSP crime database.
Use this when the user asks about specific cases, incidents, or wants to find FIRs 
by location, date, status, or officer. Returns a list of matching FIR records.`,
    parameters: {
      type: "object",
      properties: {
        district:     { type: "string", description: "District name in Karnataka (e.g. Bengaluru Urban, Mysuru)" },
        station_name: { type: "string", description: "Partial or full police station name" },
        date_from:    { type: "string", description: "Start date in YYYY-MM-DD format" },
        date_to:      { type: "string", description: "End date in YYYY-MM-DD format" },
        status:       { type: "string", enum: ["OPEN","UNDER_INVESTIGATION","CHARGESHEETED","CLOSED","ACQUITTED"], description: "FIR status filter" },
        limit:        { type: "number", description: "Max records to return (default 20, max 100)" },
      },
      required: [],
    },
  },
  {
    name: "fn_crime_by_type",
    description: `Query crimes filtered by IPC section or crime category.
Use when the user asks about specific crime types like murder (IPC 302),
theft (IPC 378), assault, robbery, etc.`,
    parameters: {
      type: "object",
      properties: {
        ipc_section:   { type: "string", description: "IPC section number(s), comma-separated (e.g. '302' or '302,307')" },
        category_code: { type: "string", description: "Crime category code (e.g. THEFT, ASSAULT, MURDER, ROBBERY)" },
        district:      { type: "string", description: "Optional district filter" },
        date_from:     { type: "string", description: "Start date YYYY-MM-DD" },
        date_to:       { type: "string", description: "End date YYYY-MM-DD" },
        limit:         { type: "number", description: "Max records (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "fn_hotspot_data",
    description: `Get crime hotspot aggregations grouped by geography.
Use when the user asks where crimes are concentrated, which areas are most dangerous,
or wants a map of crime distribution.`,
    parameters: {
      type: "object",
      properties: {
        district:      { type: "string",  description: "Optional: filter to a specific district" },
        category_code: { type: "string",  description: "Optional: filter by crime type" },
        time_range:    { type: "string",  enum: ["7d","30d","90d","1y","all"], description: "Time range for aggregation" },
        group_by:      { type: "string",  enum: ["station","district"], description: "Aggregation level (default: station)" },
      },
      required: ["time_range"],
    },
  },
  {
    name: "fn_trend_analysis",
    description: `Get time-series trend data for crime metrics.
Use when the user asks about crime trends over time, whether crime is increasing or
decreasing, monthly/weekly patterns, seasonal analysis, or year-over-year comparisons.`,
    parameters: {
      type: "object",
      properties: {
        metric:        { type: "string", enum: ["total_firs","arrests","resolution_rate","open_cases"], description: "Metric to trend" },
        granularity:   { type: "string", enum: ["daily","weekly","monthly","yearly"], description: "Time bucket size" },
        date_from:     { type: "string", description: "Start date YYYY-MM-DD" },
        date_to:       { type: "string", description: "End date YYYY-MM-DD" },
        district:      { type: "string", description: "Optional district filter" },
        category_code: { type: "string", description: "Optional crime type filter" },
      },
      required: ["metric", "granularity"],
    },
  },
  {
    name: "fn_accused_lookup",
    description: `Look up accused/suspect records across FIRs.
Use when the user asks about a specific suspect, repeat offenders, arrest rates,
or wants to find all cases linked to a person.`,
    parameters: {
      type: "object",
      properties: {
        name:          { type: "string", description: "Partial or full name of accused" },
        arrest_status: { type: "string", enum: ["AT_LARGE","ARRESTED","BAILED","CONVICTED","ACQUITTED"], description: "Filter by arrest status" },
        district:      { type: "string", description: "District of accused address" },
        fir_id:        { type: "number", description: "Look up accused for a specific FIR" },
        limit:         { type: "number", description: "Max records (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "fn_station_stats",
    description: `Get performance and activity statistics for a specific police station.
Use when the user asks about a station's workload, resolution rates, pending cases,
or wants to compare stations.`,
    parameters: {
      type: "object",
      properties: {
        station_name: { type: "string", description: "Station name (partial match supported)" },
        station_id:   { type: "number", description: "Station ROWID if known" },
        date_from:    { type: "string", description: "Start date YYYY-MM-DD" },
        date_to:      { type: "string", description: "End date YYYY-MM-DD" },
      },
      required: [],
    },
  },
  {
    name: "fn_summary_stats",
    description: `Get high-level KPI summary statistics for the dashboard.
Use when the user asks for an overview, summary of the crime situation,
total counts, or district-level comparisons.`,
    parameters: {
      type: "object",
      properties: {
        district:  { type: "string", description: "Optional district filter (omit for Karnataka-wide)" },
        date_from: { type: "string", description: "Start date YYYY-MM-DD" },
        date_to:   { type: "string", description: "End date YYYY-MM-DD" },
      },
      required: [],
    },
  },
];
