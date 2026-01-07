import { createSlice } from "@reduxjs/toolkit";
import { padZeros } from "utils/formatting";

export const initialState: SequencesState = {
  allSequences: [],
  metadata: null,
};

export const sequencesSlice = createSlice({
  name: "sequences",
  initialState,
  reducers: {
    /** Add one (or more) Sequence(s) to the store */
    addSequences: (state, action: { payload: FetchResponse<Sequence[]> }) => {
      state.allSequences = action.payload.data;
      state.metadata = action.payload.fetchMetadata;
    },

    /** Clear all Sequences from the store */
    clearSequences: (state) => {
      state.allSequences = [];
      state.metadata = null;
    },

    /** An error occured fetching wiki data */
    fetchError: (state, action: { payload: string }) => {
      state.metadata = {
        success: false,
        error: action.payload,
        timestamp: state.metadata?.timestamp || new Date().toISOString(),
      };
    },
  },
});

export const { addSequences, clearSequences, fetchError } = sequencesSlice.actions;

/**
 * Get a potential Sequence ID from an ISO or UTC date string
 * @param date ISO or UTC date string
 */
export const idFromDate = (date: string): string => {
  const d = new Date(date);
  const yyyy = d.getUTCFullYear();
  const mm = d.getUTCMonth() + 1;
  const dd = d.getUTCDate();
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
): Activity[] => {
  const res: Activity[] = [];

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
