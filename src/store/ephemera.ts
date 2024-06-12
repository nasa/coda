import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";
import { diff } from "../utils/date";

export const initialState: EphemeraState = {
  ephemerisFiles: [],
  responseMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
};

export const ephemeraSlice = createSlice({
  name: "ephemera",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    addEphemera: (state, action: { payload: WrappedResponse<EphemerisStore> }) => {
      state.ephemerisFiles = action.payload.data.ephemera;
      state.responseMetadata = { ...state.responseMetadata, ...action.payload.responseMetadata };
    },
    clearEphemera: (state) => {
      state.ephemerisFiles = [];
      state.responseMetadata = null;
    },

    fetchError: (state, action: { payload: string }) => {
      state.responseMetadata = { ...state.responseMetadata, error: action.payload };
    },
    setEphemeraLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { addEphemera, clearEphemera, fetchError, setEphemeraLoadingStatus } =
  ephemeraSlice.actions;

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
