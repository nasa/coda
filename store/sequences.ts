import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import type { EntityState } from "@reduxjs/toolkit";
import { diff } from "./playhead";
import { padZeros } from "utils/formatting";
import {
  Sequence,
  Activity,
  DayNight,
  WrappedResponse,
  ResMetadata,
  LoadingStatusEnum,
} from "typings";

/** Parse the ID from an Sequence, currently set to a `yyyy-mm-dd-name` string */
export function idFromSequence(sequence: Sequence): string {
  const { startDate, name, type, location } = sequence;
  const [yyyy, mm, dd] = startDate.split("-").map((d) => padZeros(+d, 2));
  // TODO: location isn't working?
  return `${yyyy}-${mm}-${dd}-${location}-${type}-${name}`;
}

export type SequencesEntityState = EntityState<Sequence> & {
  metadata: ResMetadata;
  loadingStatus: LoadingStatusEnum;
  lastChecked: string;
};

const sequencesAdapter = createEntityAdapter<Sequence>({
  selectId: idFromSequence,
  // Keep the "all IDs" array sorted based on date descending
  sortComparer: (a, b) => diff(new Date(a.startDate), new Date(b.startDate)),
});

export const initialState: SequencesEntityState = sequencesAdapter.getInitialState({
  metadata: null,
  loadingStatus: LoadingStatusEnum.Loading,
  lastChecked: "",
});

export const sequencesSlice = createSlice({
  name: "Sequences",
  initialState,
  reducers: {
    /** Add one (or more) Sequence(s) to the store */
    addSequences: (state, action: { payload: WrappedResponse<Sequence[]> }) => {
      sequencesAdapter.upsertMany(state, action.payload.data);
      state.metadata = action.payload.metadata;
      state.lastChecked = new Date().toISOString();
    },

    /** An error occured fetching wiki data */
    fetchError: (state, action: { payload: string }) => {
      state.metadata.error = action.payload;
    },

    setSequenceLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { addSequences, fetchError, setSequenceLoadingStatus } = sequencesSlice.actions;

export const sequencesSelector = sequencesAdapter.getSelectors<SequencesEntityState>(
  (state) => state
);

/**
 * Get a potential Sequence ID from an ISO or UTC date string
 * @param date ISO or UTC date string
 */
export const idFromDate = (date: string): string => {
  const d = new Date(date);
  let yyyy = d.getUTCFullYear();
  let mm = d.getUTCMonth() + 1;
  let dd = d.getUTCDate();
  return `${yyyy}-${padZeros(mm, 2)}-${padZeros(dd, 2)}`;
};

/** Start time of an Sequence in UTC milliseconds */
export const getSequenceStartMilliseconds = (Sequence: Sequence): number => {
  const { startDate, startTime } = Sequence;
  const [Y, M, D] = startDate.split("-").map(Number);
  const [hh, mm] = startTime.split(/:/).map(Number);
  return Date.UTC(Y, M - 1, D, hh, mm);
};

/** Translate as-performed Sequence activities to mission time */
export const getAsPerformedMissionTime = (
  asExecuted: Activity[],
  SequenceDate: string,
  activityStartUTCMilliseconds: number
) => {
  const res = [] as Activity[];

  // get activity times in the mission timeframe
  let thisStartTimeSeconds =
    (activityStartUTCMilliseconds - new Date(SequenceDate).getTime()) / 1000;

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
export const getDayNightMissionTime = (dayNight: DayNight): DayNight => {
  const events = [] as Activity[];
  const startOfDay = new Date(
    `${new Date(dayNight.dataStartUTC).toUTCString().split("T")[0]}T00:00:00Z`
  );

  // slightly different for dayNight object
  let thisStartTimeSeconds = (dayNight.dataStartUTC - startOfDay.getTime()) / 1000;

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
