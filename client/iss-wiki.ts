/**
 * Methods for fetching data from the ISS Wiki. Browsers will use a proxy, servers will hit the ISS Wiki directly
 */
import get from "lodash/get";
import { padZeros } from "utils/formatting";
import type { WrappedResponse } from "typings";
import type { AllCrews, AllExecution, EVA, EVASummaryResponse } from "typings/wiki";

/** Fetch a summary of all EVAs on the wiki */
async function fetchAllEVAs(): Promise<EVASummaryResponse> {
  const res = await fetch("/api/evas/all-evas");
  let wrappedResponse: WrappedResponse<EVASummaryResponse> = await res.json();
  return wrappedResponse.data;
}

/** Fetch as-executed data for all EVAs */
async function fetchAllAsExecuted(): Promise<AllExecution> {
  const res = await fetch("/api/evas/all-as-executed");
  let wrappedResponse: WrappedResponse<AllExecution> = await res.json();
  return wrappedResponse.data;
}

/** Fetch all crew members for all EVAs */
async function fetchAllCrew(): Promise<AllCrews> {
  const res = await fetch("/api/evas/all-crew");
  let wrappedResponse: WrappedResponse<AllCrews> = await res.json();
  return wrappedResponse.data;
}

/** Fetch all crew members for all EVAs */
export async function fetchStore(): Promise<EVA[]> {
  const res = await fetch("/api/evas/all");
  let wrappedResponse: WrappedResponse<EVA[]> = await res.json();
  return wrappedResponse.data;
}
