// ============================================================
// functions/fn-search-fir/index.ts
// Tool: Search FIRs by district, station, date range, status
// ============================================================

import * as catalyst from "zcatalyst-sdk-node";
import { query } from "../../shared/db";
import type { SearchFIRParams, FIRRow } from "../../shared/types";

module.exports = async (
  context: catalyst.ICatalystContext,
  basicIO: catalyst.IBasicIO
): Promise<void> => {
  try {
    const params = JSON.parse(basicIO.getRequestBody()) as SearchFIRParams;
    const { district, station_name, date_from, date_to, status, limit = 20 } = params;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (district) {
      conditions.push("d.name LIKE ?");
      values.push(`%${district}%`);
    }
    if (station_name) {
      conditions.push("s.name LIKE ?");
      values.push(`%${station_name}%`);
    }
    if (date_from) {
      conditions.push("f.date_filed >= ?");
      values.push(date_from);
    }
    if (date_to) {
      conditions.push("f.date_filed <= ?");
      values.push(`${date_to} 23:59:59`);
    }
    if (status) {
      conditions.push("f.status = ?");
      values.push(status);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const safeLimit = Math.min(Number(limit), 100);

    const sql = `
      SELECT
        f.ROWID           AS id,
        f.fir_number,
        f.date_filed,
        f.incident_date,
        f.ipc_sections,
        f.status,
        f.incident_area,
        f.incident_lat    AS lat,
        f.incident_lng    AS lng,
        f.assigned_officer,
        s.name            AS station_name,
        s.station_code,
        d.name            AS district,
        cc.name           AS crime_category,
        cc.severity
      FROM fir f
      JOIN station s         ON f.station_id  = s.ROWID
      JOIN district d        ON s.district_id = d.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
      ${whereClause}
      ORDER BY f.date_filed DESC
      LIMIT ${safeLimit}
    `;

    const countSQL = `
      SELECT COUNT(*) AS total
      FROM fir f
      JOIN station s         ON f.station_id  = s.ROWID
      JOIN district d        ON s.district_id = d.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
      ${whereClause}
    `;

    const [rows, countRows] = await Promise.all([
      query<FIRRow>(context, sql, values),
      query<{ total: number }>(context, countSQL, values),
    ]);

    basicIO.setResponse(200, {
      total:   countRows[0]?.total ?? rows.length,
      showing: rows.length,
      firs:    rows,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fn-search-fir]", message);
    basicIO.setResponse(500, { error: message });
  }
};
