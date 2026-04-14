type GPSUpsertRequest = {
  id?: number;
  date: string;
  name: string;
  gpxData: string;
};

type VideoUpsertRequest = {
  id?: number;
  videoId: string;
  startTime: string;
};

type PhotoUpsertRequest = {
  id?: number;
  date: string;
  source: Source;
  nasaIdRegex: string;
  timeOffset: string;
};

interface GPSTracksQueryParams {
  dateWanted: string;
}

interface EphemerisQueryParams {
  dateWanted: string;
}

type EphemerisUpsertRequest = {
  records: Array<EphemerisEntry>;
  origin: "spacetrack" | "seed";
};

type MediaOverrideUpsertRequest = MediaOverride;

interface MediaOverrideQueryParams {
  dateWanted: string;
}

type AncillaryDataUpsertRequest = {
  id?: number;
  date: string;
  source: Source;
  type: "graphs";
  url: string;
};

interface AncillaryDataQueryParams {
  dateWanted: string;
}

interface DayNightQueryParams {
  dateWanted: string;
  dayNightSource?: string;
  // add support for year month date query params for Maestro
  //    remove when Maestro is updated to use dateWanted
  year?: number;
  month?: number;
  date?: number;
}

interface VideoQueryParams {
  videoId: string;
}

interface PhotoQueryParams {
  dateWanted: string;
}
