// ============================================================
// functions/fn-accused-lookup/index.ts
// Tool: Accused / suspect lookup + repeat offender detection
// ============================================================

import * as catalyst from "zcatalyst-sdk-node";
import { query } from "../../shared/db";
import type { AccusedLookupParams, AccusedRow, RepeatOffender } from "../../shared/types";

module.exports = async (
  context: catalyst.ICatalystContext,
  basicIO: catalyst.IBasicIO
): Promise<void> => {
  try {
    const params = JSON.parse(basicIO.getRequestBody()) as AccusedLookupParams;
    const { name, arrest_status, district, fir_id, limit = 20 } = params;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (name)          { conditions.push("(a.name LIKE ? OR a.alias LIKE ?)"); values.push(`%${name}%`, `%${name}%`); }
    if (arrest_status) { conditions.push("a.arrest_status = ?");               values.push(arrest_status); }
    if (district)      { conditions.push("d.name LIKE ?");                     values.push(`%${district}%`); }
    if (fir_id)        { conditions.push("a.fir_id = ?");                      values.push(fir_id); }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const safeLimit = Math.min(Number(limit), 100);

    const sql = `
      SELECT
        a.ROWID           AS id,
        a.name,
        a.alias,
        a.age,
        a.gender,
        a.occupation,
        a.address,
        a.arrest_status,
        a.arrest_date,
        f.fir_number,
        f.date_filed,
        f.ipc_sections,
        f.status          AS fir_status,
        cc.name           AS crime_category,
        cc.severity,
        s.name            AS station_name,
        d.name            AS district
      FROM accused a
      JOIN fir f             ON a.fir_id      = f.ROWID
      JOIN station s         ON f.station_id  = s.ROWID
      JOIN district d        ON s.district_id = d.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
      ${whereClause}
      ORDER BY f.date_filed DESC
      LIMIT ${safeLimit}
    `;

    const repeatSQL = `
      SELECT
        a.name,
        a.alias,
        a.age,
        a.gender,
        COUNT(DISTINCT a.fir_id)  AS fir_count,
        a.arrest_status,
        GROUP_CONCAT(DISTINCT cc.name ORDER BY cc.name SEPARATOR ', ') AS crime_types,
        MAX(f.date_filed)          AS last_incident
      FROM accused a
      JOIN fir f             ON a.fir_id      = f.ROWID
      JOIN station s         ON f.station_id  = s.ROWID
      JOIN district d        ON s.district_id = d.ROWID
      JOIN crime_category cc ON f.category_id = cc.ROWID
      ${whereClause}
      GROUP BY a.name, a.alias, a.age, a.gender, a.arrest_status
      HAVING fir_count > 1
      ORDER BY fir_count DESC
      LIMIT 10
    `;

    const [accused, repeatOffenders] = await Promise.all([
      query<AccusedRow>(context, sql, values),
      query<RepeatOffender>(context, repeatSQL, values),
    ]);

    basicIO.setResponse(200, {
      total:            accused.length,
      accused,
      repeat_offenders: repeatOffenders,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fn-accused-lookup]", message);
    basicIO.setResponse(500, { error: message });
  }
};
