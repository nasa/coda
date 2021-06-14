/**
 * Methods for fetching data from the ISS Wiki. Browsers will use a proxy, servers will hit the ISS Wiki directly
 */
import type { WrappedResponse } from "typings";
import type { Sequence } from "typings";

/** Fetch all EVA data */
export async function fetchEVAs(): Promise<Sequence[]> {
  const res = await fetch("/api/sequences/evas");
  let wrappedResponse: WrappedResponse<Sequence[]> = await res.json();
  return wrappedResponse.data;
}

/** Fetch all Rock Yard data */
export async function fetchRockYard(): Promise<Sequence[]> {
  const res = await fetch("/api/sequences/test-events");
  let wrappedResponse: WrappedResponse<Sequence[]> = await res.json();
  return wrappedResponse.data;
}
