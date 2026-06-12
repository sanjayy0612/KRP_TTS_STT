// ============================================================
// functions/fn-hotspot-data/index.ts
// Tool: Geo aggregation for crime hotspots
// ============================================================

import * as catalyst from "zcatalyst-sdk-node";
import { query, timeRangeToSQL } from "../../shared/db";
import type { HotspotParams, HotspotPoint } from "../../shared/types";

interface RawHotspotRow extends Omit<HotspotPoint, "intensity"> {
  total_crimes: number;
}

module.exports = async (
  context: catalyst.ICatalystContext,
  basicIO: catalyst.IBasicIO
): Promise<void> => {
  try {
    const params = JSON.parse(basicIO.getRequestBody()) as HotspotParams;
    const { district, category_code, time_range = "30d", group_by = "station" } = params;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    const timeFilter = timeRangeToSQL("f.date_filed", time_range);
    if (timeFilter) conditions.push(timeFilter);

    if (district) {
      conditions.push("d.name LIKE ?");
      values.push(`%${district}%`);
    }
    if (category_code) {
      conditions.push("cc.code = ?");
      values.push(category_code.toUpperCase());
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const sql = group_by === "station"
      ? `
        SELECT
          s.ROWID          AS station_id,
          s.name           AS label,
          s.station_code,
          s.lat,
          s.lng,
          d.name           AS district,
          COUNT(f.ROWID)   AS total_crimes,
          SUM(CASE WHEN f.status = 'OPEN' THEN 1 ELSE 0 END) AS open_cases,
          SUM(CASE WHEN f.status IN ('CHARGESHEETED','CLOSED') THEN 1 ELSE 0 END) AS resolved,
          ROUND(
            SUM(CASE WHEN f.status IN ('CHARGESHEETED','CLOSED') THEN 1 ELSE 0 END)
            / COUNT(f.ROWID) * 100, 1
          ) AS resolution_rate
        FROM fir f
        JOIN station s         ON f.station_id  = s.ROWID
        JOIN district d        ON s.district_id = d.ROWID
        JOIN crime_category cc ON f.category_id = cc.ROWID
        ${whereClause}
        GROUP BY s.ROWID, s.name, s.station_code, s.lat, s.lng, d.name
        ORDER BY total_crimes DESC
      `
      : `
        SELECT
          d.ROWID          AS district_id,
          d.name           AS label,
          d.lat,
          d.lng,
          COUNT(f.ROWID)   AS total_crimes,
          SUM(CASE WHEN f.status = 'OPEN' THEN 1 ELSE 0 END) AS open_cases,
          SUM(CASE WHEN f.status IN ('CHARGESHEETED','CLOSED') THEN 1 ELSE 0 END) AS resolved,
          ROUND(
            SUM(CASE WHEN f.status IN ('CHARGESHEETED','CLOSED') THEN 1 ELSE 0 END)
            / COUNT(f.ROWID) * 100, 1
          ) AS resolution_rate,
          COUNT(DISTINCT s.ROWID) AS station_count
        FROM fir f
        JOIN station s         ON f.station_id  = s.ROWID
        JOIN district d        ON s.district_id = d.ROWID
        JOIN crime_category cc ON f.category_id = cc.ROWID
        ${whereClause}
        GROUP BY d.ROWID, d.name, d.lat, d.lng
        ORDER BY total_crimes DESC
      `;

    const rows = await query<RawHotspotRow>(context, sql, values);

    const counts   = rows.map((r) => r.total_crimes);
    const maxCount = Math.max(...counts, 1);

    const points: HotspotPoint[] = rows.map((r) => ({
      ...r,
      count:     r.total_crimes,
      intensity: r.total_crimes >= maxCount * 0.66 ? "high"
               : r.total_crimes >= maxCount * 0.33 ? "medium"
               : "low",
    }));

    basicIO.setResponse(200, {
      group_by,
      time_range,
      total_points: points.length,
      max_crimes:   maxCount,
      points,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fn-hotspot-data]", message);
    basicIO.setResponse(500, { error: message });
  }
};
