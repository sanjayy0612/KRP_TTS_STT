// ============================================================
// functions/fn-crime-by-type/index.ts
// Tool: Filter crimes by IPC section or category
// ============================================================

import * as catalyst from "zcatalyst-sdk-node";
import { query } from "../../shared/db";
import type { CrimeByTypeParams, FIRRow, CategoryBreakdown } from "../../shared/types";

module.exports = async (
  context: catalyst.ICatalystContext,
  basicIO: catalyst.IBasicIO
): Promise<void> => {
  try {
    const params = JSON.parse(basicIO.getRequestBody()) as CrimeByTypeParams;
    const { ipc_section, category_code, district, date_from, date_to, limit = 20 } = params;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (ipc_section) {
      const sections = ipc_section.split(",").map((s) => s.trim());
      const ipcConds = sections.map(() => "FIND_IN_SET(?, REPLACE(f.ipc_sections, ' ', ''))");
      conditions.push(`(${ipcConds.join(" OR ")})`);
      values.push(...sections);
    }
    if (category_code) {
      conditions.push("cc.code = ?");
      values.push(category_code.toUpperCase());
    }
    if (district) {
      conditions.push("d.name LIKE ?");
      values.push(`%${district}%`);
    }
    if (date_from) {
      conditions.push("f.date_filed >= ?");
      values.push(date_from);
    }
    if (date_to) {
      conditions.push("f.date_filed <= ?");
      values.push(`${date_to} 23:59:59`);
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
        f.ipc_sections,
        f.status,
        f.incident_area,
        f.incident_lat    AS lat,
        f.incident_lng    AS lng,
        cc.name           AS crime_category,
        cc.code           AS category_code,
        cc.severity,
        s.name            AS station_name,
        d.name            AS district
      FROM fir f
      JOIN station s         ON f.station_id  = s.ROWID
      JOIN district d        ON s.district_id = d.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
      ${whereClause}
      ORDER BY f.date_filed DESC
      LIMIT ${safeLimit}
    `;

    const breakdownSQL = `
      SELECT
        cc.name     AS category,
        cc.severity,
        COUNT(*)    AS count,
        SUM(CASE WHEN f.status IN ('CHARGESHEETED','CLOSED') THEN 1 ELSE 0 END) AS resolved
      FROM fir f
      JOIN station s         ON f.station_id  = s.ROWID
      JOIN district d        ON s.district_id = d.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
      ${whereClause}
      GROUP BY cc.ROWID, cc.name, cc.severity
      ORDER BY count DESC
    `;

    const [rows, breakdown] = await Promise.all([
      query<FIRRow>(context, sql, values),
      query<CategoryBreakdown>(context, breakdownSQL, values),
    ]);

    basicIO.setResponse(200, { total: rows.length, firs: rows, breakdown });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fn-crime-by-type]", message);
    basicIO.setResponse(500, { error: message });
  }
};
