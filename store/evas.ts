import get from "lodash/get";
import { createSelector, createSlice } from "@reduxjs/toolkit";
import type { Activity, DayNight, EVA } from "services/iss-wiki";
import type { TimingData } from "store/videos";
import { PlayheadState } from "./playhead";
import { padZeros } from "utils/formatting";

/** Keyed by UTC date in the format of `yyyy-mm-dd` */
export type EVAStore = { [key: string]: EVA };

export interface EVAsState {
  objects: EVAStore;
  /** Message describing something that went wrong fetching EVAs */
  errorMessage: string;
  /** UTC string of the last time we hit IO */
  lastChecked: string;
}

export const initialState: EVAsState = {
  objects: {},
  errorMessage: "",
  lastChecked: "",
};

export const evasSlice = createSlice({
  name: "evas",
  initialState,
  reducers: {
    /** Add one (or more) EVA(s) to the store */
    addEVAs: (state: EVAsState, action: { payload: { [key: string]: EVA } }) => {
      state.objects = { ...state.objects, ...action.payload };
      state.lastChecked = new Date().toUTCString();
      state.errorMessage = "";
    },

    /** An error occured fetching wiki data */
    fetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { addEVAs, fetchError } = evasSlice.actions;

/** Start time of an EVA in UTC milliseconds */
export const getEVAStartMilliseconds = (eva: EVA): number => {
  const { startDate, startTime } = eva;
  const [Y, M, D] = startDate.split("-").map(Number);
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

/** Select the active EVA for the playhead */
export const evaSelector = (state: EVAsState, date: PlayheadState["date"]): EVA => {
  const d = new Date(date);
  const yyyy = d.getUTCFullYear();
  const mm = padZeros(d.getUTCMonth() + 1, 2);
  const dd = padZeros(d.getUTCDate(), 2);
  return get(state.objects, `${yyyy}-${mm}-${dd}`, null);
};

export const selectEVAStartMilliseconds = createSelector(evaSelector, getEVAStartMilliseconds);
