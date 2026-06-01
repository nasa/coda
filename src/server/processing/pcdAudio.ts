import { getORM } from "server/express/global";
import { PcdAudio_db } from "server/database/models/PcdAudio.model";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Fetches the most recent PCD audio record for the given source from the database.
 * PCD audio data is not date-dependent — all recordings for a mission are stored
 * in a single record and filtered client-side by date.
 */
export default async function getPcdAudioData({
  source,
}: {
  source: Source;
  dateWanted: string;
}): Promise<FetchResponse<PcdAudioJson | null>> {
  try {
    const em = getORM().em.fork();
    const record = await em.findOne(PcdAudio_db, { source }, { orderBy: { id: "DESC" } });

    return {
      data: record?.audioJson ?? null,
      fetchMetadata: {
        success: true,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (e) {
    ConsoleLogger.error(e);
    return {
      data: null,
      fetchMetadata: {
        success: false,
        error: String(e),
        timestamp: new Date().toISOString(),
      },
    };
  }
}
