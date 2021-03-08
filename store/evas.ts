import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import type { Activity, DayNight, EVA } from "services/iss-wiki";
import type { TimingData } from "store/videos";
import { diff } from "./playhead";
import { padZeros } from "utils/formatting";
import { RootState } from ".";

/** Parse the ID from an EVA, currently set to a `yyyy-mm-dd` string */
export function idFromEVA(eva: EVA): string {
  const { startDate } = eva;
  const [yyyy, mm, dd] = startDate.split("-").map((d) => padZeros(+d, 2));
  return `${yyyy}-${mm}-${dd}`;
}

const evaAdapter = createEntityAdapter<EVA>({
  selectId: idFromEVA,
  // Keep the "all IDs" array sorted based on date descending
  sortComparer: (a, b) => diff(new Date(a.startDate), new Date(b.startDate)),
});

export const initialState = evaAdapter.getInitialState({
  errorMessage: "",
  lastChecked: "",
});

export const evasSlice = createSlice({
  name: "evas",
  initialState,
  reducers: {
    /** Add one (or more) EVA(s) to the store */
    addEVAs: (state, action) => {
      evaAdapter.upsertMany(state, action);
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

export const evasSelector = evaAdapter.getSelectors<RootState>((state) => state.evas);

/**
 * Get a potential EVA ID from an ISO or UTC date string
 * @param date ISO or UTC date string
 */
export const idFromDate = (date: string): string => {
  const d = new Date(date);
  let yyyy = d.getUTCFullYear();
  let mm = d.getUTCMonth() + 1;
  let dd = d.getUTCDate();
  return `${yyyy}-${padZeros(mm, 2)}-${padZeros(dd, 2)}`;
};

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
