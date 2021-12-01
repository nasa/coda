import { GPSTrack } from "typings/gps";

export async function getGPSTracks(year: number, month: number, date: number): Promise<GPSTrack[]> {
  const res = await fetch(`/api/sequences/gps?year=${year}&month=${month}&date=${date}`);
  const gpsTracks: GPSTrack[] = await res.json();

  return gpsTracks;
}
