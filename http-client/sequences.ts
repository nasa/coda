/**
 * Methods for fetching data from the Wiki. Browsers will use a proxy, servers will hit the ISS Wiki directly
 */

/** Fetch all EVA data */
export async function fetchEVAs(): Promise<WrappedResponse<Sequence[]>> {
  const res = await fetch("/api/sequences/evas?agency=all");
  let wrappedResponse: WrappedResponse<Sequence[]> = await res.json();
  return wrappedResponse;
}

/** Fetch all Test Event data */
export async function fetchTestEvents(): Promise<WrappedResponse<Sequence[]>> {
  const res = await fetch("/api/sequences/test-events");
  const wrappedResponse: WrappedResponse<Sequence[]> = await res.json();
  return wrappedResponse;
}

export async function getGPSTracks(
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<GPSTrack[]>> {
  const res = await fetch(`/api/sequences/gps?year=${year}&month=${month}&date=${date}`);
  const gpsTracks: WrappedResponse<GPSTrack[]> = await res.json();

  return gpsTracks;
}

export async function getGraphsManifest(
  source: Source,
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<GraphsManifest>> {
  const res = await fetch(
    `/api/sequences/graphs?source=${source}&year=${year}&month=${month}&date=${date}`
  );
  const graphManifest: WrappedResponse<GraphsManifest> = await res.json();

  return graphManifest;
}
