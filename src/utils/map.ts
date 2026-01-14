import { getAppropriateTLE } from "store/ephemera";
import { getLatLngObj } from "tle.js";

export const getNextPosition = (
  dateTime: string,
  increment: number,
  ephemerisEntries: EphemerisEntry[]
): { lat: number; lng: number } => {
  // Find the closest ephemera item
  const tle = getAppropriateTLE(ephemerisEntries, dateTime);

  // Calculate the time offset in milliseconds
  const baseTime = new Date(dateTime).getTime();
  const offsetTime = baseTime + increment * 1000; // assuming increment is in seconds

  // Get latitude and longitude using tle.js utility
  const { lat, lng } = getLatLngObj(tle, offsetTime);

  return { lat, lng };
};

export const updateOrbitLine = (
  dateTime: string,
  timeStr: string,
  ephemeraItems: EphemerisEntry[]
): { coordinates1: [number, number][]; coordinates2: [number, number][] } => {
  const secondsStart = -2000;
  const secondsEnd = 3800;
  const secondsStep = 10;

  const coordinates1: [number, number][] = [];
  const coordinates2: [number, number][] = [];
  let prevIncrement = -1;
  let prevLng = -1;

  let dateLineHit = false;
  let dateLineIncNum = 0;
  for (let i = secondsStart; i < secondsEnd; i += secondsStep) {
    // Combine date and time strings to create a full ISO date-time
    const fullDateTime = `${dateTime}T${timeStr}Z`;
    const nextPosition = getNextPosition(fullDateTime, i, ephemeraItems);

    let lngIncrement = 0;
    let lngStepSize = 0;
    if (prevLng !== -1) {
      lngIncrement = Math.abs(nextPosition.lng - prevLng);
      lngStepSize = Math.abs(lngIncrement - prevIncrement);
    }

    // if crossing date line, start drawing the second line
    // (this avoids a segment that wraps around the earth)
    if (prevIncrement !== -1 && lngStepSize > 100) {
      dateLineHit = true;
      dateLineIncNum = i;
      break;
    }
    coordinates1.push([nextPosition.lng, nextPosition.lat]);
    prevLng = nextPosition.lng;
    prevIncrement = lngIncrement;
  }

  // draw second line that continues across the date line if path crosses date line
  if (dateLineHit) {
    for (let i = dateLineIncNum; i < secondsEnd; i += secondsStep) {
      const fullDateTime = `${dateTime}T${timeStr}Z`;
      const nextPosition = getNextPosition(fullDateTime, i, ephemeraItems);
      coordinates2.push([nextPosition.lng, nextPosition.lat]);
    }
  }

  return { coordinates1, coordinates2 };
};
