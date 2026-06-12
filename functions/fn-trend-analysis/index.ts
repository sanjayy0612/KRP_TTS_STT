// ============================================================
// functions/fn-trend-analysis/index.ts
// Tool: Time-series trend data
// ============================================================

import * as catalyst from "zcatalyst-sdk-node";
import { query } from "../../shared/db";
import type { TrendParams, TrendPoint, TrendGranularity } from "../../shared/types";

const DATE_FORMAT: Record<TrendGranularity, string> = {
  daily:   "%Y-%m-%d",
  weekly:  "%x-W%v",
  monthly: "%Y-%m",
  yearly:  "%Y",
};

const METRIC_EXPR: Record<string, string> = {
  total_firs:      "COUNT(f.ROWID)",
  arrests:         "SUM(CASE WHEN a.arrest_status = 'ARRESTED' THEN 1 ELSE 0 END)",
  resolution_rate: "ROUND(SUM(CASE WHEN f.status IN ('CHARGESHEETED','CLOSED') THEN 1 ELSE 0 END) / COUNT(f.ROWID) * 100, 1)",
  open_cases:      "SUM(CASE WHEN f.status = 'OPEN' THEN 1 ELSE 0 END)",
};

module.exports = async (
  context: catalyst.ICatalystContext,
  basicIO: catalyst.IBasicIO
): Promise<void> => {
  try {
    const params = JSON.parse(basicIO.getRequestBody()) as TrendParams;
    const { metric = "total_firs", granularity = "monthly", date_from, date_to, district, category_code } = params;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (date_from) { conditions.push("f.date_filed >= ?"); values.push(date_from); }
    if (date_to)   { conditions.push("f.date_filed <= ?"); values.push(`${date_to} 23:59:59`); }
    if (district)  { conditions.push("d.name LIKE ?");     values.push(`%${district}%`); }
    if (category_code) { conditions.push("cc.code = ?");   values.push(category_code.toUpperCase()); }

    const whereClause  = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const fmt          = DATE_FORMAT[granularity] ?? "%Y-%m";
    const metricExpr   = METRIC_EXPR[metric] ?? "COUNT(f.ROWID)";
    const accusedJoin  = metric === "arrests" ? "LEFT JOIN accused a ON a.fir_id = f.ROWID" : "";

    const sql = `
      SELECT
        DATE_FORMAT(f.date_filed, '${fmt}') AS period,
        ${metricExpr}                        AS value
      FROM fir f
      JOIN station s         ON f.station_id  = s.ROWID
      JOIN district d        ON s.district_id = d.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
      ${accusedJoin}
      ${whereClause}
      GROUP BY DATE_FORMAT(f.date_filed, '${fmt}')
      ORDER BY period ASC
    `;

    const rows  = await query<TrendPoint>(context, sql, values);
    const vals  = rows.map((r) => Number(r.value));
    const total = vals.reduce((a, b) => a + b, 0);

    const trend =
      vals.length >= 2
        ? vals[vals.length - 1] > vals[0] ? "increasing"
        : vals[vals.length - 1] < vals[0] ? "decreasing"
        : "stable"
        : "stable";

    basicIO.setResponse(200, {
      metric,
      granularity,
      trend,
      summary: {
        total,
        avg:     vals.length ? +(total / vals.length).toFixed(1) : 0,
        max:     Math.max(...vals, 0),
        min:     Math.min(...vals, 0),
        periods: rows.length,
      },
      series: rows,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fn-trend-analysis]", message);
    basicIO.setResponse(500, { error: message });
  }
};
