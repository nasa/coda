import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import type { Ephemeris } from "services/spacetrack";
import { RootState } from ".";
import { diff } from "./playhead";

export function idFromEphemeris(ephemeris: Ephemeris): string {
  const { FILE } = ephemeris;
  return FILE;
}

const ephemerisAdapter = createEntityAdapter<Ephemeris>({
  selectId: idFromEphemeris,
  // Keep the "all IDs" array sorted based on date descending
  sortComparer: (a, b) => diff(new Date(a.EPOCH), new Date(b.EPOCH)),
});

export const initialState = ephemerisAdapter.getInitialState({
  errorMessage: "",
  dayNight: {},
});

export const ephemeraSelectors = ephemerisAdapter.getSelectors<RootState>(
  (state) => state.ephemera
);

export const ephemeraSlice = createSlice({
  name: "ephemera",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    addEphemera: (state, action) => {
      ephemerisAdapter.upsertMany(state, action.payload.ephemera);
      state.dayNight = action.payload.dayNight;
      state.errorMessage = "";
    },
    fetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { addEphemera, fetchError } = ephemeraSlice.actions;

/**
 * Returns a Two-Line Element (TLE) from space-track.org that is closest to dateTimeWanted
 * @param ephemera
 * @param dateTimeWanted
 * @returns TLE string
 */
export function getAppropriateTLE(ephemera: Ephemeris[], dateTimeWanted: string): string {
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
