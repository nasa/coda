type GPSUpsertRequest = {
  id?: number;
  date: string;
  name: string;
  gpxData: string;
};

interface GPSTracksQueryParams {
  dateWanted: string;
}

type MediaOverrideUpsertRequest = {
  id: number;
  date: string;
  source: "ARTEMIS" | "ISS" | "NBL" | "TEST_EVENTS";
  type: "video" | "photo" | "transcript" | "audio";
  url: string;
};

interface MediaOverrideQueryParams {
  dateWanted: string;
}

type AncillaryDataUpsertRequest = {
  id: number;
  date: string;
  source: "ARTEMIS" | "ISS" | "NBL" | "TEST_EVENTS";
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
