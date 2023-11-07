import type { NextApiRequest, NextApiResponse } from "next";
import mssql from "mssql";

/**
 * `/api/cldb/content?disciplines=EVA|OSO&year=yyyy&julianday=ddd`
 *
 * Get console log database data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { disciplines, year, julianday } = req.query as { [key: string]: string };

  const allowedDisciplines = ["EVA"];
  const disciplineArr = disciplines.split("|");
  for (const dis of disciplineArr) {
    if (!allowedDisciplines.includes(dis)) {
      const allowed = allowedDisciplines.join(", ");
      return res.status(403).json({
        error: `Forbidden: Discipline ${dis} is not in allowed values ${allowed}`,
      });
    }
  }
  const disConditional = disciplineArr.map((d) => `DSCPLN='${d}'`).join(" AND ");

  if (year.length !== 4 || year !== parseInt(year).toString()) {
    res.status(400).json({ error: "year must be 4-digit integer" });
  }

  if (
    julianday.length !== 3 || // must be three digits
    julianday.split("").filter((c) => c >= "0" && c <= "9").length !== 3 // must all be integers
  ) {
    res.status(400).json({ error: "julian day must be 3-digit integer" });
  }

  const sqlConfig = {
    user: process.env.CLDB_USER,
    password: process.env.CLDB_PASSWORD,
    database: process.env.CLDB_DATABASE,
    server: process.env.CLDB_SERVER,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };

  const query = `SELECT * from Mission WHERE (${disConditional}) AND GMT LIKE '${year}:${julianday}:%'`;
  try {
    await mssql.connect(sqlConfig);
    const result = await mssql.query(query);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error(`An error occurred. Query was: ${query}`);
    console.error(err);
    res.status(400).json({ error: `An error occurred of type ${err?.code || "UNKNOWN"}` });
  }
}
