import fs from "fs";

/**
 * Fetch as-planned and as-executed EVA data and standardize the format
 *
 * @param agency `us|rs|all`. Get US EVAs, RS EVAs, or all EVAs across both space agencies
 * */
export async function getAllEVAData(agency: AgencyQuery): Promise<FetchResponse<Sequence[]>> {
  // TEMPORARY: Read from JSON file instead of wiki
  const fileName = agency === "us" ? "wiki-us.json" : "wiki-all.json";
  const allEvasData = JSON.parse(
    fs.readFileSync(`src/server/services/tempWikiData/${fileName}`, "utf-8")
  );

  return {
    data: allEvasData,
    fetchMetadata: {
      success: true,
      timestamp: new Date().toISOString(),
    },
  };
}

/** Fetch as-planned and as-executed EVA data and standardize the format */
export async function getAllTestEventsData(): Promise<FetchResponse<Sequence[]>> {
  // TEMPORARY: Read from JSON file instead of wiki
  const testEventsData = JSON.parse(
    fs.readFileSync("src/server/services/tempWikiData/test-events.json", "utf-8")
  );

  return {
    data: testEventsData,
    fetchMetadata: {
      success: true,
      timestamp: new Date().toISOString(),
    },
  };
}
