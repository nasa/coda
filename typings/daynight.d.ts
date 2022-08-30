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

// TODO: Depricated and to be removed when dayNight is removed from the iss location API response
interface DayNightObjDepricated {
  appSeconds: number;
  daylight: boolean;
}
