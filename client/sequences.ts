/**
 * Methods for fetching data from the ISS Wiki. Browsers will use a proxy, servers will hit the ISS Wiki directly
 */
import type { WrappedResponse } from "typings";
import type { EVA } from "typings/wiki";

/** Fetch all EVA data */
export async function fetchEVAs(): Promise<EVA[]> {
  const res = await fetch("/api/sequences/evas");
  let wrappedResponse: WrappedResponse<EVA[]> = await res.json();
  return wrappedResponse.data;
}

/** Fetch all Rock Yard data */
export async function fetchRockYard(): Promise<EVA[]> {
  const res = await fetch("/api/sequences/jsc-rock-yard");
  let wrappedResponse: WrappedResponse<EVA[]> = await res.json();
  return wrappedResponse.data;
}
