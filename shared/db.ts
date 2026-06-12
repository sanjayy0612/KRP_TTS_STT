// ============================================================
// shared/db.ts
// Typed Catalyst Data Store query helper
// ============================================================

import * as catalyst from "zcatalyst-sdk-node";

/**
 * Execute a parameterized SQL query against Catalyst Data Store.
 * Returns a typed array of rows.
 */
export async function query<T = Record<string, unknown>>(
  context: catalyst.ICatalystContext,
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<T[]> {
  const app       = catalyst.initialize(context);
  const datastore = app.datastore();
  const finalSQL  = bindParams(sql, params);

  console.log("[DB] Query:", finalSQL);

  const result = await datastore.executeQuery(finalSQL);
  return (result ?? []) as T[];
}

/**
 * Safely bind positional ? params into SQL string.
 */
function bindParams(
  sql: string,
  params: (string | number | boolean | null)[]
): string {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const val = params[i++];
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "number")           return String(val);
    if (typeof val === "boolean")          return val ? "1" : "0";
    return `'${String(val).replace(/'/g, "''")}'`;
  });
}

/**
 * Build a WHERE clause from a filters map.
 * Returns the clause string and ordered values array.
 */
export function buildWhereClause(
  filters: Record<string, string | number | null | undefined>
): { clause: string; values: (string | number)[] } {
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  for (const [col, val] of Object.entries(filters)) {
    if (val === undefined || val === null || val === "") continue;
    conditions.push(`${col} = ?`);
    values.push(val);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

/**
 * Convert a time_range string into a SQL date filter expression.
 * Returns empty string for "all".
 */
export function timeRangeToSQL(column: string, timeRange: string): string {
  const intervalMap: Record<string, string> = {
    "7d":  "INTERVAL 7 DAY",
    "30d": "INTERVAL 30 DAY",
    "90d": "INTERVAL 90 DAY",
    "1y":  "INTERVAL 1 YEAR",
  };

  const interval = intervalMap[timeRange];
  if (!interval) return "";
  return `${column} >= DATE_SUB(NOW(), ${interval})`;
}
