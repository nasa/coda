import type { GPSTrackCollection } from "typings/ancillary";

export async function buildGPSTracksStore(
  year: number,
  month: number,
  date: number,
  eventType: string
): Promise<GPSTrackCollection> {
  const res = await fetch(
    `/api/ancillary/getGPSTracks?year=${year}&month=${month}&date=${date}&eventType=${eventType}`
  );
  const gpsTracks: GPSTrackCollection = await res.json();
  return gpsTracks;
}
