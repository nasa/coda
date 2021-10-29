import type { AncillaryPayload } from "typings/ancillary";

export async function buildAncillaryPayloadsStore(
  year: number,
  month: number,
  date: number,
  eventType: string
): Promise<AncillaryPayload> {
  const res = await fetch(
    `/api/ancillary/getAncillaryData?year=${year}&month=${month}&date=${date}&eventType=${eventType}`
  );
  const ancillaryPayload: AncillaryPayload = await res.json();
  return ancillaryPayload;
}
