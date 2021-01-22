import { createSelector, createSlice } from "@reduxjs/toolkit";
import type { Activity, DayNight, EVA } from "services/iss-wiki";
import type { TimingData } from "store/videos";

export interface EVAsState {
  /** Keyed in the format of underscored lowercase EVA name, eg. `us_eva_55` */
  EVAs: { [key: string]: EVA };
  /** Format of underscored lowercase EVA name, eg. `us_eva_55` */
  selectedEVA: string;
  /** Message describing something that went wrong fetching EVAs */
  errorMessage: string;
}

export const initialState: EVAsState = {
  EVAs: {},
  selectedEVA: "",
  errorMessage: "",
};

export const evasSlice = createSlice({
  name: "evas",
  initialState,
  reducers: {},
});

/** Start time of an EVA in UTC milliseconds */
export const getEVAStartMilliseconds = (eva: EVA): number => {
  const { startDate, startTime } = eva;
  const [Y, M, D] = startDate.split("/").map(Number);
  const [hh, mm] = startTime.split(/:/).map(Number);
  return Date.UTC(Y, M - 1, D, hh, mm);
};

/** Translate as-performed EVA activities to mission time */
export const getActivityPerformanceMissionTime = (
  asExecuted,
  timingData,
  activityStartUTCMilliseconds
) => {
  const res = [] as Activity[];

  // get activity times in the mission timeframe
  let thisStartTimeSeconds =
    (activityStartUTCMilliseconds - timingData.video_earliestStart.getTime()) / 1000;

  for (let a = 0; a < asExecuted.length; a++) {
    const { color, content, duration } = asExecuted[a];
    const activity = {
      color,
      content,
      duration,
      startTimeSeconds: thisStartTimeSeconds,
      endTimeSeconds: thisStartTimeSeconds + duration,
    } as Activity;
    res.push(activity);

    thisStartTimeSeconds = thisStartTimeSeconds + duration;
  }

  return res;
};

/** Translate day/night cycles to mission time */
export const getDayNightMissionTime = (dayNight: DayNight, timingData: TimingData): DayNight => {
  const events = [] as Activity[];

  // slightly different for dayNight object
  let thisStartTimeSeconds =
    (dayNight.dataStartUTC - timingData.video_earliestStart.getTime()) / 1000;

  for (let e = 0; e < dayNight.events.length; e++) {
    const { color, content, duration } = dayNight.events[e];
    const event = {
      color,
      content,
      duration,
      startTimeSeconds: thisStartTimeSeconds,
      endTimeSeconds: thisStartTimeSeconds + duration * 60,
    } as Activity;

    events.push(event);

    thisStartTimeSeconds = thisStartTimeSeconds + duration * 60;
  }

  return {
    dataStartUTC: dayNight.dataStartUTC,
    events,
  };
};

export const evaSelector = (state: EVAsState) => state.EVAs[state.selectedEVA];

export const selectEVAStartMilliseconds = createSelector(evaSelector, getEVAStartMilliseconds);
