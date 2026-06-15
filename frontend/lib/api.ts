import type { OrchestratorRequest, OrchestratorResponse } from "./types";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "/api";

function buildUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function submitOrchestratorQuery(
  payload: OrchestratorRequest,
): Promise<OrchestratorResponse> {
  const response = await fetch(buildUrl("/query"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<OrchestratorResponse> & {
    error?: string;
    details?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || data.details || `Request failed with status ${response.status}`);
  }

  return data as OrchestratorResponse;
}
