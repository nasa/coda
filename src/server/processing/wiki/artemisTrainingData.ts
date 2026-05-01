/**
 * Artemis Training (AxEMU) Data Fetcher
 *
 * Fetches AxEMU training event metadata and as-executed timelines from the exploration wiki,
 * then combines them into the Sequence[] format used by the app.
 */
import { collection, sequenceType } from "utils/consts";
import { ConsoleLogger } from "utils/logging/consoleLogger";
import { WIKI_BASE_URL } from "./auth";
import { getAllAxEMUTrainingEvents, getAxEMUTrainingExecution } from "./artemisTrainingQueries";
import { parseAsExecuted } from "./parsers";

const parseHHMM = (time: string | null): string => {
  const match = time?.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) {
    return ":";
  }

  const hours = parseInt(match[1], 10);
  if (hours > 23) {
    return ":";
  }

  return `${hours.toString().padStart(2, "0")}:${match[2]}`;
};

const secondsFromHHMM = (time: string): number | null => {
  if (time === ":") {
    return null;
  }

  const [hours, minutes] = time.split(":").map(Number);
  return hours * 3600 + minutes * 60;
};

/**
 * Get AxEMU training event data from the exploration wiki
 *
 * Fetches event metadata and as-executed timelines,
 * then combines them into the Sequence[] format used by the app.
 */
export async function getArtemisTrainingData(): Promise<FetchResponse<Sequence[]>> {
  try {
    ConsoleLogger.info("Fetching Artemis training (AxEMU) data from wiki...");

    // Step 1: Get all training events
    const allEvents = await getAllAxEMUTrainingEvents();

    ConsoleLogger.info(`Fetched ${allEvents.length} AxEMU training events`);

    // Step 2: Get timeline tasks for those events (needs event page names to build query)
    const eventPageNames = allEvents.map((e) => e.pageName);
    const executionTasks = await getAxEMUTrainingExecution(eventPageNames);

    ConsoleLogger.info(`Fetched ${executionTasks.length} timeline tasks`);

    // Parse timeline data with actorOffset=0 (Actor 1 = EV1, no SSRMS skip)
    const asExecuted = parseAsExecuted(executionTasks, 0);

    // Transform into Sequence format
    const sequences: Sequence[] = allEvents
      .filter((event) => event["Event Date"]) // Filter out events without a date
      .map((event) => {
        const eventName = event.pageName;
        const eventTitle = event["Event Title"] || eventName;
        const testEnvironment = event["Test Environment"] || "";

        // Parse start date (format: YYYY-MM-DD from wiki)
        const startDate = (event["Event Date"] || "").split(" ")[0];

        const startTime = parseHHMM(event.startTime ?? null);
        const endTime = parseHHMM(event.endTime ?? null);
        const startSeconds = secondsFromHHMM(startTime);
        const endSeconds = secondsFromHHMM(endTime);
        const duration =
          startSeconds !== null && endSeconds !== null
            ? (endSeconds - startSeconds + 24 * 3600) % (24 * 3600) || -1
            : -1;

        // Build display title
        const displayTitle = testEnvironment ? `${eventTitle} (${testEnvironment})` : eventTitle;

        // Get as-executed timeline for this event
        const asPerformed = asExecuted[eventName] || {};

        // Build crew from event-level EV1/EV2 fields
        const crew: Crew = {
          EV1: event.EV1 || "",
          EV2: event.EV2 || "",
          SUIT_IV: "",
        };

        return {
          name: eventName,
          location: collection.ARTEMIS_TRAINING,
          type: sequenceType.training,
          dataURL: `${WIKI_BASE_URL}/exploration/index.php/${eventName.replace(/ /g, "_")}`,
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

    ConsoleLogger.info(`Returning ${sequences.length} Artemis training sequences`);

    return {
      data: sequences,
      fetchMetadata: {
        success: true,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    ConsoleLogger.error("Error fetching Artemis training data:", error);
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
