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
  forceNew?: boolean;
  dayNightSource?: string;
}

interface GetTranscriptsQueryParams {
  dateWanted: string;
  source: Source;
  forceNew?: boolean;
}

interface GetSgAudioQueryParams {
  dateWanted: string;
  source: Source;
  forceNew?: boolean;
}

interface GetEphemerisQueryParams {
  dateWanted: string;
  forceNew?: boolean;
}

interface GetMaestroExecuteTimelineStatusQueryParams {
  uuid: string;
}

interface GetVideosQueryParams {
  dateWanted: string;
  source: Source;
  forceNew?: boolean;
}

interface GetPhotosQueryParams {
  dateWanted: string;
  source: Source;
  forceNew?: boolean;
}

interface GetSequencesAllEvasQueryParams {
  agency: AgencyQuery;
  forceNew?: boolean;
}

interface GetSequencesTestEventsQueryParams {
  forceNew?: boolean;
}

interface GetGraphsManifestQueryParams {
  dateWanted: string;
  source: Source;
  forceNew?: boolean;
}

interface VideoQueryParams {
  videoId: string;
}

interface PhotoQueryParams {
  dateWanted: string;
}
