/**
 * ISS EVA Data Fetcher
 *
 * Fetches EVA metadata, crew assignments, and as-executed timelines from the ISS wiki,
 * then combines them into the Sequence[] format used by the app.
 */
import { formatEVADisplayTitle, padZeros } from "utils/formatting";
import { collection, sequenceType } from "utils/consts";
import { ConsoleLogger } from "utils/logging/consoleLogger";
import { WIKI_BASE_URL } from "./auth";
import { getAllEVAs, getAllAsExecuted, getAllCrew } from "./evaQueries";
import { parseAsExecuted, parseCrews } from "./parsers";

/**
 * Get ISS EVA data in the format expected by the scheduler
 *
 * This fetches EVA metadata, crew assignments, and as-executed timelines,
 * then combines them into the Sequence[] format used by the app.
 */
export async function getISSEvaData(): Promise<FetchResponse<Sequence[]>> {
  try {
    ConsoleLogger.info("Fetching ISS EVA data from wiki...");

    // Fetch all data in parallel
    const [allEVAs, asExecutedTasks, crewData] = await Promise.all([
      getAllEVAs(),
      getAllAsExecuted(),
      getAllCrew(),
    ]);

    ConsoleLogger.info(
      `Fetched ${allEVAs.length} EVAs, ${asExecutedTasks.length} tasks, ${crewData.length} crew entries`
    );

    // Parse the raw data
    const asExecuted = parseAsExecuted(asExecutedTasks);
    const crews = parseCrews(crewData);

    // Transform into Sequence format
    const sequences: Sequence[] = allEVAs
      .filter((eva) => eva["Start date"]) // Filter out EVAs without start date
      .map((eva) => {
        const evaName = eva.pageName;
        const formattedEVAName = evaName.replace(/ /g, "_").toLowerCase();

        // Parse duration
        const durationHours = parseInt(eva["Duration hour"] || "0", 10);
        const durationMinutes = parseInt(eva["Duration minute"] || "0", 10);
        const duration =
          durationHours > 0 || durationMinutes > 0
            ? durationHours * 3600 + durationMinutes * 60
            : -1;

        // Parse start date (format: YYYY-MM-DD from wiki)
        const startDateRaw = eva["Start date"] || "";
        // Wiki returns date in format "YYYY-MM-DD" or may have time portion
        const startDate = startDateRaw.split(" ")[0];

        // Parse start time
        const startHour = eva["Start hour"] || "";
        const startMinute = eva["Start minute"] || "";
        const startTime =
          startHour && startMinute
            ? `${padZeros(parseInt(startHour, 10), 2)}:${padZeros(parseInt(startMinute, 10), 2)}`
            : ":";

        // Build display title
        const displayTitle = formatEVADisplayTitle({
          pageName: evaName,
          descriptiveTitle: eva["EVA title"] || "",
        });

        // Get crew for this EVA
        const crew = crews[formattedEVAName] || {
          EV1: "Unknown",
          EV2: "Unknown",
          SUIT_IV: "Unknown",
        };

        // Get as-performed timeline for this EVA
        const asPerformed = asExecuted[evaName] || { EV1: [], EV2: [] };

        return {
          name: evaName,
          maestroEventUuid: eva["Maestro event uuid"] || false,
          location: collection.ISS,
          type: sequenceType.EVA,
          dataURL: `${WIKI_BASE_URL}/iss/index.php/${evaName.replace(/ /g, "_")}`,
          displayTitle,
          startDate,
          startTime,
          duration,
          asPerformed,
          crew,
        } as Sequence;
      })
      // Sort by date descending (newest first)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    ConsoleLogger.info(`Returning ${sequences.length} EVA sequences`);

    return {
      data: sequences,
      fetchMetadata: {
        success: true,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    ConsoleLogger.error("Error fetching ISS EVA data:", error);
    return {
      data: [],
      fetchMetadata: {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
