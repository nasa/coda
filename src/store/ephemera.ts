import { createSlice } from "@reduxjs/toolkit";
import { diff } from "../utils/date";

export const initialState: EphemeraState = {
  ephemerisFiles: [],
  metadata: null,
};

export const ephemeraSlice = createSlice({
  name: "ephemera",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    addEphemera: (state, action: { payload: FetchResponse<EphemerisStore> }) => {
      state.ephemerisFiles = action.payload.data?.ephemera || [];
      state.metadata = action.payload.fetchMetadata;
    },
    clearEphemera: (state) => {
      state.ephemerisFiles = [];
      state.metadata = null;
    },

    fetchError: (state, action: { payload: string }) => {
      state.metadata = {
        success: false,
        error: action.payload,
        timestamp: state.metadata?.timestamp || new Date().toISOString(),
      };
    },
  },
});

export const { addEphemera, clearEphemera, fetchError } = ephemeraSlice.actions;

/**
 * Returns a Two-Line Element (TLE) from space-track.org that is closest to dateTimeWanted
 * @param ephemera
 * @param dateTimeWanted
 * @returns TLE string
 */
export function getAppropriateTLE(ephemera: EphemerisFile[], dateTimeWanted: string): string {
  let thisDateDiff;
  let lastDateDiff = -1;

  let tleObj = ephemera[0];
  let mostRecentTLE = `${tleObj.TLE_LINE0}
                  ${tleObj.TLE_LINE1}
                  ${tleObj.TLE_LINE2}`;

  // chew through ephemiris data looking for the TLE closest to the timestamp of interest
  for (let i = 0; i < ephemera.length; i++) {
    thisDateDiff = Math.abs(diff(new Date(ephemera[i].EPOCH + "Z"), new Date(dateTimeWanted)));
    if (i !== 0 && thisDateDiff < lastDateDiff) {
      tleObj = ephemera[i];
      mostRecentTLE = `${tleObj.TLE_LINE0}
                  ${tleObj.TLE_LINE1}
                  ${tleObj.TLE_LINE2}`;
    }
    lastDateDiff = thisDateDiff;
  }

  return mostRecentTLE;
}
