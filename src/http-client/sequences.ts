import { queryStringFromObject } from "utils/formatting";
/**
 * Methods for fetching data from the Wiki. Browsers will use a proxy, servers will hit the ISS Wiki directly
 */

/** Fetch all EVA data */
export async function fetchEVAs(): Promise<WrappedResponse<Sequence[]>> {
  const queryParams: GetSequencesAllEvasQueryParams = {
    agency: "all",
  };
  const queryString = queryStringFromObject(queryParams);
  const res = await fetch(`/api/v1/sequences/evas?${queryString}`);
  let wrappedResponse: WrappedResponse<Sequence[]> = await res.json();
  return wrappedResponse;
}

/** Fetch all Test Event data */
export async function fetchTestEvents(): Promise<WrappedResponse<Sequence[]>> {
  const res = await fetch("/api/v1/sequences/test-events");
  const wrappedResponse: WrappedResponse<Sequence[]> = await res.json();
  return wrappedResponse;
}

export async function getGraphsManifest(
  dateWanted: string,
  source: Source
): Promise<WrappedResponse<GraphsManifest>> {
  const queryParams: GetGraphsManifestQueryParams = {
    dateWanted,
    source,
  };
  const queryString = queryStringFromObject(queryParams);
  const res = await fetch(`/api/v1/sequences/graphs?${queryString}`);
  const graphManifest: WrappedResponse<GraphsManifest> = await res.json();

  return graphManifest;
}
