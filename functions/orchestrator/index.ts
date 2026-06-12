// ============================================================
// functions/orchestrator/index.ts
// Central orchestrator — STT + LLM tool calling loop
// ============================================================

import * as catalyst from "zcatalyst-sdk-node";
import { TOOL_DEFINITIONS } from "../../shared/tools";
import type {
  OrchestratorRequest,
  OrchestratorResponse,
  LLMMessage,
  LLMResponse,
  LLMToolCall,
} from "../../shared/types";

// ── Env ───────────────────────────────────────────────────────
const QUICKML_ENDPOINT  = process.env.QUICKML_LLM_ENDPOINT!;
const QUICKML_API_KEY   = process.env.QUICKML_API_KEY!;
const ZIA_STT_ENDPOINT  = process.env.ZIA_STT_ENDPOINT!;
const ZIA_ACCESS_TOKEN  = process.env.ZIA_ACCESS_TOKEN!;
const CACHE_TTL         = 300; // seconds

const TOOL_URLS: Record<string, string> = {
  fn_search_fir:    process.env.FN_SEARCH_FIR_URL!,
  fn_crime_by_type: process.env.FN_CRIME_BY_TYPE_URL!,
  fn_hotspot_data:  process.env.FN_HOTSPOT_DATA_URL!,
  fn_trend_analysis:process.env.FN_TREND_ANALYSIS_URL!,
  fn_accused_lookup:process.env.FN_ACCUSED_LOOKUP_URL!,
  fn_station_stats: process.env.FN_STATION_STATS_URL!,
  fn_summary_stats: process.env.FN_SUMMARY_STATS_URL!,
};

// ── System Prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an AI assistant for the Karnataka State Police (KSP) crime intelligence system.
You help investigators query and understand crime data from the KSP Crime Database,
which contains FIRs from 1100+ police stations across Karnataka.

RULES:
- Always use the provided tools to fetch real data before answering
- Never hallucinate crime statistics — only report what tools return
- Be concise but precise — investigators need actionable information
- Always include counts and time ranges for context

RESPONSE FORMAT — always respond with valid JSON only (no markdown, no preamble):
{
  "answer": "Plain language summary",
  "chart_type": "bar | line | pie | map | table | none",
  "chart_data": [{ "label": "...", "value": 0 }],
  "map_points": [{ "lat": 0, "lng": 0, "label": "...", "count": 0, "intensity": "low|medium|high" }],
  "table_data": { "columns": ["..."], "rows": [[]] },
  "kpis": [{ "label": "...", "value": "...", "change": "..." }],
  "follow_up_suggestions": ["..."],
  "data_range": "Human readable date range"
}
Only include fields that are relevant. Null out unused fields.`;

// ── Handler ───────────────────────────────────────────────────
module.exports = async (
  context: catalyst.ICatalystContext,
  basicIO: catalyst.IBasicIO
): Promise<void> => {
  const app   = catalyst.initialize(context);
  const cache = app.cache();

  try {
    const body = JSON.parse(basicIO.getRequestBody()) as OrchestratorRequest;
    const { audio_base64, audio_mime_type, text, user_id } = body;

    // Step 1: Resolve query text
    let queryText = text?.trim() ?? "";
    if (!queryText && audio_base64) {
      queryText = await speechToText(audio_base64, audio_mime_type ?? "audio/wav");
    }
    if (!queryText) {
      basicIO.setResponse(400, { error: "No query provided (text or audio required)" });
      return;
    }

    console.log(`[Orchestrator] Query: "${queryText}" | User: ${user_id ?? "anon"}`);

    // Step 2: Cache check
    const cacheKey = `q:${Buffer.from(queryText.toLowerCase()).toString("base64").slice(0, 80)}`;
    try {
      const cached = await cache.getValue(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached as string) as OrchestratorResponse;
        basicIO.setResponse(200, { ...parsed, cached: true, query_text: queryText });
        return;
      }
    } catch { /* cache miss */ }

    // Step 3: LLM tool loop
    const result = await runLLMWithTools(queryText);

    // Step 4: Store in cache
    try {
      await cache.putValue(cacheKey, JSON.stringify(result), CACHE_TTL);
    } catch { /* non-fatal */ }

    basicIO.setResponse(200, { ...result, query_text: queryText, cached: false });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Orchestrator] Fatal:", message);
    basicIO.setResponse(500, { error: "Internal server error", details: message });
  }
};

// ── Speech-to-Text via Catalyst Zia ───────────────────────────
async function speechToText(audioBase64: string, mimeType: string): Promise<string> {
  const res = await fetch(ZIA_STT_ENDPOINT, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Zoho-oauthtoken ${ZIA_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      audio_data: audioBase64,
      audio_type: mimeType,
      language:   "en-IN",
    }),
  });

  if (!res.ok) throw new Error(`Zia STT failed: ${res.status}`);
  const data = await res.json() as { transcript?: string; text?: string };
  return data.transcript ?? data.text ?? "";
}

// ── LLM Tool Calling Loop ─────────────────────────────────────
async function runLLMWithTools(queryText: string): Promise<OrchestratorResponse> {
  const messages: LLMMessage[] = [{ role: "user", content: queryText }];
  const MAX_ROUNDS = 4;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const llmMsg = await callLLM(messages);

    if (llmMsg.tool_calls && llmMsg.tool_calls.length > 0) {
      // Append assistant turn with tool calls
      messages.push({
        role:       "assistant",
        content:    llmMsg.content ?? "",
        tool_calls: llmMsg.tool_calls,
      });

      // Execute all tools in parallel
      const results = await Promise.all(
        llmMsg.tool_calls.map((tc) =>
          executeTool(tc.function.name, JSON.parse(tc.function.arguments) as Record<string, unknown>)
        )
      );

      // Append tool results
      llmMsg.tool_calls.forEach((tc: LLMToolCall, i: number) => {
        messages.push({
          role:         "tool",
          content:      JSON.stringify(results[i]),
          tool_call_id: tc.id,
        });
      });

      continue; // next round
    }

    // Final answer — parse structured JSON
    const raw = llmMsg.content ?? "";
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      return JSON.parse(clean) as OrchestratorResponse;
    } catch {
      return {
        answer:                raw,
        chart_type:            "none",
        chart_data:            null,
        map_points:            null,
        table_data:            null,
        kpis:                  null,
        follow_up_suggestions: [],
        data_range:            "",
        query_text:            queryText,
        cached:                false,
      };
    }
  }

  return {
    answer:                "Could not complete query — too many tool rounds required.",
    chart_type:            "none",
    chart_data:            null,
    map_points:            null,
    table_data:            null,
    kpis:                  null,
    follow_up_suggestions: [],
    data_range:            "",
    query_text:            queryText,
    cached:                false,
  };
}

// ── Call QuickML LLM ──────────────────────────────────────────
async function callLLM(messages: LLMMessage[]): Promise<LLMResponse> {
  const res = await fetch(QUICKML_ENDPOINT, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${QUICKML_API_KEY}`,
    },
    body: JSON.stringify({
      model:       "gpt-4o",
      messages:    [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      tools:       TOOL_DEFINITIONS.map((t) => ({ type: "function", function: t })),
      tool_choice: "auto",
      temperature: 0.1,
    }),
  });

  if (!res.ok) throw new Error(`LLM call failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { choices: [{ message: LLMResponse }] };
  return data.choices[0].message;
}

// ── Execute Tool Function ─────────────────────────────────────
async function executeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const url = TOOL_URLS[toolName];
  if (!url) {
    console.error(`[Orchestrator] Unknown tool: ${toolName}`);
    return { error: `Unknown tool: ${toolName}` };
  }

  console.log(`[Orchestrator] → ${toolName}`, params);

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(params),
    });

    if (!res.ok) return { error: `Tool ${toolName} returned ${res.status}` };
    return await res.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Orchestrator] Tool ${toolName} threw:`, msg);
    return { error: msg };
  }
}
