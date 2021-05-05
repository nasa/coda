import { padZeros, hhmmssFromSeconds } from "utils/formatting";

import type { EphemerisFile, EphemerisStore } from "typings/spacetrack";

export async function buildEphemerisStore(
  year: number,
  month: number,
  date: number
): Promise<EphemerisStore> {
  const dateStr = `${year}-${padZeros(month, 2)}-${padZeros(date, 2)}`;
  const ephemera = await fetchSpacetrack(dateStr);
  const dayNight = calcDayNight(ephemera, dateStr);

  return {
    ephemera: ephemera,
    dayNight: dayNight,
  };
}
