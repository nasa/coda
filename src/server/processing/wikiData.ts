import fs from "fs";

/** Get ISS EVA data (compatible with socket fetch functions) */
export async function getISSEvaData({
  // ignore source and dateWanted. We only have those parameters set to make this function compatible with the other socket fetch functions.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dateWanted,
}: {
  dateWanted: string;
}): Promise<FetchResponse<Sequence[]>> {
  const data = JSON.parse(
    fs.readFileSync("src/server/processing/tempWikiData/wiki-all.json", "utf-8")
  );

  return {
    data,
    fetchMetadata: {
      success: true,
      timestamp: new Date().toISOString(),
    },
  };
}

/** Get test events data */
export async function getTestEventsData(): Promise<FetchResponse<Sequence[]>> {
  const data = JSON.parse(
    fs.readFileSync("src/server/processing/tempWikiData/test-events.json", "utf-8")
  );

  return {
    data,
    fetchMetadata: {
      success: true,
      timestamp: new Date().toISOString(),
    },
  };
}
