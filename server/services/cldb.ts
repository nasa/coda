import mssql from "mssql";

export async function fetchConsoleLog(
  disciplines: string,
  year: number,
  julianday: number
): Promise<WrappedResponse<any>> {
  let res: WrappedResponse<any> = {
    cacheMetadata: {
      fromCache: false,
      stale: false,
      timestamp: new Date(),
      error: null,
    },
    data: {},
  };

  const allowedDisciplines = ["EVA"];
  const disciplineArr = disciplines.split("|");
  for (const dis of disciplineArr) {
    if (!allowedDisciplines.includes(dis)) {
      const allowed = allowedDisciplines.join(", ");
      res.cacheMetadata.error = `Forbidden: Discipline ${dis} is not in allowed values ${allowed}`;
    }
  }

  const disConditional = disciplineArr.map((d) => `DSCPLN='${d}'`).join(" AND ");

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
    res.data = JSON.stringify(result.recordset);
  } catch (err) {
    console.error(`An error occurred. Query was: ${query}`);
    console.error(err);
    res.cacheMetadata.error = `An error occurred of type ${err?.code || "UNKNOWN"}`;
  }

  return res;
}
