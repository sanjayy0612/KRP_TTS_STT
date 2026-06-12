// ============================================================
// functions/fn-summary-stats/index.ts
// Tool: Karnataka-wide KPI summary for dashboard
// ============================================================

import * as catalyst from "zcatalyst-sdk-node";
import { query } from "../../shared/db";
import type {
  SummaryStatsParams,
  KPISummary,
  ArrestSummary,
  WeeklyComparison,
} from "../../shared/types";

interface DistrictSummary {
  district:        string;
  lat:             number;
  lng:             number;
  total_firs:      number;
  open_cases:      number;
  resolution_rate: number;
}

interface CategorySummary {
  category:   string;
  severity:   string;
  count:      number;
  percentage: number;
}

module.exports = async (
  context: catalyst.ICatalystContext,
  basicIO: catalyst.IBasicIO
): Promise<void> => {
  try {
    const params = JSON.parse(basicIO.getRequestBody()) as SummaryStatsParams;
    const { district, date_from, date_to } = params;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (district)  { conditions.push("d.name LIKE ?");      values.push(`%${district}%`); }
    if (date_from) { conditions.push("f.date_filed >= ?");   values.push(date_from); }
    if (date_to)   { conditions.push("f.date_filed <= ?");   values.push(`${date_to} 23:59:59`); }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const baseJoin = `
      FROM fir f
      JOIN station s         ON f.station_id  = s.ROWID
      JOIN district d        ON s.district_id = d.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
    `;

    const kpiSQL = `
      SELECT
        COUNT(f.ROWID)   AS total_firs,
        SUM(CASE WHEN f.status = 'OPEN' THEN 1 ELSE 0 END)                       AS open_cases,
        SUM(CASE WHEN f.status = 'UNDER_INVESTIGATION' THEN 1 ELSE 0 END)         AS under_investigation,
        SUM(CASE WHEN f.status IN ('CHARGESHEETED','CLOSED') THEN 1 ELSE 0 END)   AS resolved,
        ROUND(
          SUM(CASE WHEN f.status IN ('CHARGESHEETED','CLOSED') THEN 1 ELSE 0 END)
          / COUNT(f.ROWID) * 100, 1
        )                AS resolution_rate,
        COUNT(DISTINCT f.station_id)                          AS active_stations,
        SUM(CASE WHEN cc.severity = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_crimes,
        SUM(CASE WHEN cc.severity = 'HIGH' THEN 1 ELSE 0 END)     AS high_crimes
      ${baseJoin}
      ${whereClause}
    `;

    const topDistrictsSQL = `
      SELECT
        d.name           AS district,
        d.lat, d.lng,
        COUNT(f.ROWID)   AS total_firs,
        SUM(CASE WHEN f.status = 'OPEN' THEN 1 ELSE 0 END) AS open_cases,
        ROUND(
          SUM(CASE WHEN f.status IN ('CHARGESHEETED','CLOSED') THEN 1 ELSE 0 END)
          / COUNT(f.ROWID) * 100, 1
        ) AS resolution_rate
      ${baseJoin}
      ${whereClause}
      GROUP BY d.ROWID, d.name, d.lat, d.lng
      ORDER BY total_firs DESC
      LIMIT 10
    `;

    const topCategoriesSQL = `
      SELECT
        cc.name        AS category,
        cc.severity,
        COUNT(f.ROWID) AS count,
        ROUND(COUNT(f.ROWID) / (
          SELECT COUNT(*) ${baseJoin} ${whereClause}
        ) * 100, 1)    AS percentage
      ${baseJoin}
      ${whereClause}
      GROUP BY cc.ROWID, cc.name, cc.severity
      ORDER BY count DESC
      LIMIT 8
    `;

    const arrestsSQL = `
      SELECT
        COUNT(a.ROWID) AS total_accused,
        SUM(CASE WHEN a.arrest_status = 'ARRESTED'  THEN 1 ELSE 0 END) AS arrested,
        SUM(CASE WHEN a.arrest_status = 'AT_LARGE'  THEN 1 ELSE 0 END) AS at_large,
        SUM(CASE WHEN a.arrest_status = 'CONVICTED' THEN 1 ELSE 0 END) AS convicted,
        SUM(CASE WHEN a.arrest_status = 'BAILED'    THEN 1 ELSE 0 END) AS bailed,
        ROUND(
          SUM(CASE WHEN a.arrest_status = 'ARRESTED' THEN 1 ELSE 0 END)
          / COUNT(a.ROWID) * 100, 1
        ) AS arrest_rate
      FROM accused a
      JOIN fir f             ON a.fir_id      = f.ROWID
      JOIN station s         ON f.station_id  = s.ROWID
      JOIN district d        ON s.district_id = d.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
      ${whereClause}
    `;

    // Weekly delta — last 7 days vs prior 7 days
    const thisWeekConds = [...conditions, "f.date_filed >= DATE_SUB(NOW(), INTERVAL 7 DAY)"];
    const prevWeekConds = [...conditions,
      "f.date_filed >= DATE_SUB(NOW(), INTERVAL 14 DAY)",
      "f.date_filed <  DATE_SUB(NOW(), INTERVAL 7 DAY)",
    ];

    const makeCountSQL = (conds: string[]) => `
      SELECT COUNT(*) AS count
      FROM fir f
      JOIN station s ON f.station_id  = s.ROWID
      JOIN district d ON s.district_id = d.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
      ${conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : ""}
    `;

    const [kpis, topDistricts, topCategories, arrests, thisWeekRows, prevWeekRows] =
      await Promise.all([
        query<KPISummary>(context, kpiSQL, values),
        query<DistrictSummary>(context, topDistrictsSQL, values),
        query<CategorySummary>(context, topCategoriesSQL, values),
        query<ArrestSummary>(context, arrestsSQL, values),
        query<{ count: number }>(context, makeCountSQL(thisWeekConds), values),
        query<{ count: number }>(context, makeCountSQL(prevWeekConds), values),
      ]);

    const thisWeek = thisWeekRows[0]?.count ?? 0;
    const lastWeek = prevWeekRows[0]?.count ?? 0;
    const deltaPct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;

    const weeklyComparison: WeeklyComparison = {
      this_week: thisWeek,
      last_week: lastWeek,
      delta_pct: deltaPct,
      trend:     deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "stable",
    };

    basicIO.setResponse(200, {
      kpis:               kpis[0] ?? {},
      top_districts:      topDistricts,
      top_categories:     topCategories,
      arrests:            arrests[0] ?? {},
      weekly_comparison:  weeklyComparison,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fn-summary-stats]", message);
    basicIO.setResponse(500, { error: message });
  }
};
