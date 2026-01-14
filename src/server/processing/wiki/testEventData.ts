/**
 * Test Event Data Fetcher
 *
 * Fetches test event metadata and as-executed timelines from the exploration wiki,
 * then combines them into the Sequence[] format used by the app.
 */
import { padZeros } from "utils/formatting";
import { collection, sequenceType } from "utils/consts";
import { ConsoleLogger } from "utils/logging/consoleLogger";
import { WIKI_BASE_URL } from "./auth";
import { getAllTestEvents, getTestEventExecution, getTestEventCrews } from "./testEventQueries";
import { parseAsExecuted } from "./parsers";

/**
 * Get test events data from the exploration wiki
 *
 * This fetches test event metadata and as-executed timelines,
 * then combines them into the Sequence[] format used by the app.
 */
export async function getTestEventsData(): Promise<FetchResponse<Sequence[]>> {
  try {
    ConsoleLogger.info("Fetching test events data from wiki...");

    // Fetch all data in parallel
    const [allTestEvents, executionTasks, testCrews] = await Promise.all([
      getAllTestEvents(),
      getTestEventExecution(),
      getTestEventCrews(),
    ]);

    ConsoleLogger.info(
      `Fetched ${allTestEvents.length} test events, ${executionTasks.length} tasks, ${testCrews.length} crew entries`
    );

    // Parse the raw data
    const asExecuted = parseAsExecuted(executionTasks);

    // Create a set of test events that have subjects
    const eventsWithCrew = new Set(testCrews.map((c) => c.pageName));

    // Transform into Sequence format
    const sequences: Sequence[] = allTestEvents
      .filter((event) => event["Test date"] || event["UTC Start Date"]) // Filter out events without date
      .map((event) => {
        const testEventName = event.pageName;
        const testEnvironment = event["Test environment"] || "TEST_EVENTS";
        const flightEnvironment = event["Flight environment"] || "Unknown flight sim";

        // Parse start date
        let startDate = "";
        if (event["UTC Start Date"]) {
          startDate = event["UTC Start Date"].split(" ")[0];
        } else if (event["Test date"]) {
          startDate = event["Test date"];
        }

        // Parse start time
        const startHour = event["UTC Start Hour"] || "00";
        const startMinute = event["UTC Start Minute"] || "00";
        const startTime = `${padZeros(parseInt(startHour, 10), 2)}:${padZeros(parseInt(startMinute, 10), 2)}`;

        // Build display title
        const displayTitle = `${startDate} ${testEnvironment} / ${flightEnvironment}`;

        // Get as-performed timeline for this test event
        const asPerformed = asExecuted[testEventName] || { EV1: [], EV2: [] };

        // Check if this event has crew subjects
        const hasCrew = eventsWithCrew.has(testEventName);

        return {
          name: testEventName,
          location: collection.TEST_EVENTS,
          type: sequenceType.testing,
          dataURL: `${WIKI_BASE_URL}/exploration/index.php/${testEventName.replace(/ /g, "_").replace(":", "%3A")}`,
          displayTitle,
          startDate,
          startTime,
          duration: -1, // Test events typically don't have a defined duration
          asPerformed,
          crew: hasCrew
            ? { EV1: "Subject", EV2: "Subject", SUIT_IV: "" }
            : { EV1: "Unknown", EV2: "Unknown", SUIT_IV: "Unknown" },
        } as Sequence;
      })
      // Sort by date descending (newest first)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    ConsoleLogger.info(`Returning ${sequences.length} test event sequences`);

    return {
      data: sequences,
      fetchMetadata: {
        success: true,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    ConsoleLogger.error("Error fetching test events data:", error);
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
