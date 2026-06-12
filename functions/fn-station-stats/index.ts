// ============================================================
// functions/fn-station-stats/index.ts
// Tool: Per-station KPIs + monthly trend
// ============================================================

import * as catalyst from "zcatalyst-sdk-node";
import { query } from "../../shared/db";
import type { StationStatsParams, StationStat, CategoryBreakdown, TrendPoint } from "../../shared/types";

module.exports = async (
  context: catalyst.ICatalystContext,
  basicIO: catalyst.IBasicIO
): Promise<void> => {
  try {
    const params = JSON.parse(basicIO.getRequestBody()) as StationStatsParams;
    const { station_name, station_id, date_from, date_to } = params;

    if (!station_name && !station_id) {
      basicIO.setResponse(400, { error: "Provide station_name or station_id" });
      return;
    }

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (station_id)   { conditions.push("s.ROWID = ?");      values.push(station_id); }
    else if (station_name) { conditions.push("s.name LIKE ?"); values.push(`%${station_name}%`); }
    if (date_from)    { conditions.push("f.date_filed >= ?"); values.push(date_from); }
    if (date_to)      { conditions.push("f.date_filed <= ?"); values.push(`${date_to} 23:59:59`); }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const statsSQL = `
      SELECT
        s.ROWID                   AS station_id,
        s.name                    AS station_name,
        s.station_code,
        s.lat, s.lng,
        s.officer_in_charge,
        d.name                    AS district,
        COUNT(f.ROWID)            AS total_firs,
        SUM(CASE WHEN f.status = 'OPEN' THEN 1 ELSE 0 END)               AS open_cases,
        SUM(CASE WHEN f.status = 'UNDER_INVESTIGATION' THEN 1 ELSE 0 END) AS under_investigation,
        SUM(CASE WHEN f.status = 'CHARGESHEETED' THEN 1 ELSE 0 END)       AS chargesheeted,
        SUM(CASE WHEN f.status = 'CLOSED' THEN 1 ELSE 0 END)              AS closed,
        ROUND(
          SUM(CASE WHEN f.status IN ('CHARGESHEETED','CLOSED') THEN 1 ELSE 0 END)
          / COUNT(f.ROWID) * 100, 1
        ) AS resolution_rate
      FROM fir f
      JOIN station s         ON f.station_id  = s.ROWID
      JOIN district d        ON s.district_id = d.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
      ${whereClause}
      GROUP BY s.ROWID, s.name, s.station_code, s.lat, s.lng, s.officer_in_charge, d.name
    `;

    const crimeBreakdownSQL = `
      SELECT
        cc.name        AS category,
        cc.severity,
        COUNT(f.ROWID) AS count,
        0              AS resolved
      FROM fir f
      JOIN station s         ON f.station_id  = s.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
      ${whereClause}
      GROUP BY cc.ROWID, cc.name, cc.severity
      ORDER BY count DESC
      LIMIT 10
    `;

    const trendSQL = `
      SELECT
        DATE_FORMAT(f.date_filed, '%Y-%m') AS period,
        COUNT(f.ROWID)                     AS value
      FROM fir f
      JOIN station s ON f.station_id = s.ROWID
      ${whereClause}
      GROUP BY DATE_FORMAT(f.date_filed, '%Y-%m')
      ORDER BY period ASC
      LIMIT 12
    `;

    const [stats, crimeBreakdown, trend] = await Promise.all([
      query<StationStat>(context, statsSQL, values),
      query<CategoryBreakdown>(context, crimeBreakdownSQL, values),
      query<TrendPoint>(context, trendSQL, values),
    ]);

    basicIO.setResponse(200, { stations: stats, crime_breakdown: crimeBreakdown, monthly_trend: trend });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fn-station-stats]", message);
    basicIO.setResponse(500, { error: message });
  }
};
