# KSP Datathon — Strix Team

Karnataka State Police crime intelligence system with voice-enabled querying. Users speak questions in natural language, which are transcribed via Zia STT, routed through an LLM tool-calling loop, and answered by querying the Catalyst Data Store.

## Architecture

```
User Speech → [Zia STT] → Orchestrator → [LLM tool loop] → Function → [Catalyst DB]
                                                              → Function → ...
                                                         → Final response (text + charts)
```

- **Orchestrator** — STT + GPT-4o multi-turn tool calling (up to 4 rounds), response caching
- **7 tool functions** — each a Catalyst Function handling one query type
- **Shared modules** — types, db helpers, tool definitions

## Functions

| Function | Purpose |
|---|---|
| `fn-search-fir` | Search FIRs by district, station, date range, status |
| `fn-crime-by-type` | Filter crimes by IPC section or crime category |
| `fn-hotspot-data` | Geo aggregation for crime hotspots (station/district level) |
| `fn-trend-analysis` | Time-series trends (daily/weekly/monthly/yearly) |
| `fn-accused-lookup` | Accused/suspect lookup + repeat offender detection |
| `fn-station-stats` | Per-station KPIs, crime breakdown, monthly trend |
| `fn-summary-stats` | Karnataka-wide KPI summary with weekly comparison |

## Tech Stack

- **Runtime:** Node.js 18.x on Zoho Catalyst
- **Language:** TypeScript (ES2020, commonjs)
- **Database:** Catalyst Data Store (MySQL-compatible)
- **LLM:** OpenAI GPT-4o via Zoho QuickML
- **STT:** Zoho Zia Speech-to-Text
- **Cache:** Catalyst Cache (300s TTL)

## Project Structure

```
├── shared/
│   ├── types/index.ts       # All TypeScript interfaces
│   ├── db.ts                # query<T>(), buildWhereClause(), timeRangeToSQL()
│   └── tools.ts             # LLM tool definitions (OpenAI function-calling format)
├── functions/
│   ├── orchestrator/        # Central STT + LLM tool loop
│   ├── fn-search-fir/       # FIR search
│   ├── fn-crime-by-type/    # Crime type filtering
│   ├── fn-hotspot-data/     # Hotspot geo aggregation
│   ├── fn-trend-analysis/   # Time-series trends
│   ├── fn-accused-lookup/   # Accused lookup + repeat offenders
│   ├── fn-station-stats/    # Station KPIs
│   └── fn-summary-stats/    # Dashboard summary
├── scripts/deploy.sh        # Build + deploy all functions
├── catalyst-app.json        # Catalyst project config
├── tsconfig.base.json       # Shared TypeScript config
└── .gitignore
```

## Deploy

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Each function builds via `tsc` (extending `tsconfig.base.json`) and deploys to Catalyst individually.

## Environment Variables

Set in Catalyst console under each function's env variables:

| Variable | Used By |
|---|---|
| `QUICKML_LLM_ENDPOINT` | orchestrator |
| `QUICKML_API_KEY` | orchestrator |
| `ZIA_STT_ENDPOINT` | orchestrator |
| `ZIA_ACCESS_TOKEN` | orchestrator |
| `FN_SEARCH_FIR_URL` | orchestrator |
| `FN_CRIME_BY_TYPE_URL` | orchestrator |
| `FN_HOTSPOT_DATA_URL` | orchestrator |
| `FN_TREND_ANALYSIS_URL` | orchestrator |
| `FN_ACCUSED_LOOKUP_URL` | orchestrator |
| `FN_STATION_STATS_URL` | orchestrator |
| `FN_SUMMARY_STATS_URL` | orchestrator |
# KRP_TTS_STT
