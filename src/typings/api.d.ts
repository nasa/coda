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
  source: string;
  timeOffset: string;
};

interface GPSTracksQueryParams {
  dateWanted: string;
}

type MediaOverrideUpsertRequest = MediaOverride;

interface MediaOverrideQueryParams {
  dateWanted: string;
}

type AncillaryDataUpsertRequest = {
  id: number;
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

interface GetTranscriptsQueryParams {
  dateWanted: string;
  source: Source;
}

interface GetSgAudioQueryParams {
  dateWanted: string;
  source: Source;
}

interface GetEphemerisQueryParams {
  dateWanted: string;
}

interface GetMaestroExecuteTimelineStatusQueryParams {
  uuid: string;
}

interface GetVideosQueryParams {
  dateWanted: string;
  source: Source;
}

interface GetMTXPlaybackQueryParams {
  dateWanted: string;
  source: Source;
}

interface GetPhotosQueryParams {
  dateWanted: string;
  source: Source;
}

interface GetSequencesAllEvasQueryParams {
  agency: AgencyQuery;
}

interface GetGraphsManifestQueryParams {
  dateWanted: string;
  source: Source;
}

interface VideoQueryParams {
  videoId: string;
}

interface PhotoQueryParams {
  dateWanted: string;
}

interface EvictCacheQueryParams {
  lastUsedIsoDate: string;
  folder?: string;
}
