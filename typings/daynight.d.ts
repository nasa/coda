interface DayNightStore {
  dayNight: DayNightObj[];
}

/** Possible sun lighting states */
type SunLighting = "day" | "night" | "sunrise" | "sunset";

/** The current daylihgt state at a given appSecond */
interface DayNightObj {
  appSeconds: number;
  daylight: SunLighting;
}

interface DayNight {
  dataStartUTC?: number;
  events?: Activity[];
}
