/**
 * Methods for fetching data from the ISS Wiki. Browsers will use a proxy, servers will hit the ISS Wiki directly
 */
import get from "lodash/get";
import type {
  Activity,
  AllExecution,
  EVA,
  EVAAsExecuted,
  EVASummaryResponse,
  WikiResponse,
  WikiResults,
} from "typings/wiki";
import { padZeros } from "utils/formatting";

/** Fetch a summary of all EVAs on the wiki */
async function fetchAllEVAs(): Promise<EVASummaryResponse> {
  const res = await fetch("/api/wiki/all-evas");
  return await res.json();
}

/** Fetch as-executed data for a given EV on a given EVA */
async function fetchAllAsExecuted(): Promise<AllExecution> {
  const res = await fetch("/api/wiki/all-as-executed");
  return await res.json();
}

/** Fetch as-planned and as-executed EVA data and format it for passing to the redux store */
export async function buildEVAStore(): Promise<EVA[]> {
  const asPlanned = await fetchAllEVAs();
  const asExecuted = await fetchAllAsExecuted();
  const crews = await getAllCrew();

  return Object.keys(asPlanned).map((evaName) => {
    const formattedEVAName = evaName.replace(/ /g, "_").toLowerCase();
    let duration = -1;
    const [wikiDuration] = asPlanned[evaName].printouts.Duration;
    // for whatever reason, if no duration is specified the wiki gives us ":"
    if (wikiDuration !== ":") {
      const [h, m] = wikiDuration.split(":");
      duration = +h * 3600 + +m * 60;
    }
    const [yyyy, mm, dd] = asPlanned[evaName].printouts["Start date"][0].raw
      .substring(2)
      .split("/");
    const startDate = `${yyyy}-${padZeros(+mm, 2)}-${padZeros(+dd, 2)}`;

    return {
      name: evaName,
      wikiURL: asPlanned[evaName].fullurl,
      displayTitle: asPlanned[evaName].printouts["EVA title"][0],
      startDate,
      startTime: asPlanned[evaName].printouts["Start time"][0],
      duration,
      execution: get(asExecuted, evaName, { EV1: [], EV2: [] }),
      crew: get(crews, formattedEVAName, { EV1: "Unknown", EV2: "Unknown", SUIT_IV: "Unknown" }),
      // we need video data to calculate activityPerformance
      activityPerformance: { EV1: [], EV2: [] },
      // the wiki doesn't actually give us dayNight
      dayNight: { events: [], dataStartUTC: 0 },
    };
  });
}
