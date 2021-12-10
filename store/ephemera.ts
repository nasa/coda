import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import type { EntityState } from "@reduxjs/toolkit";
import { diff } from "./playhead";
import { LoadingStatusEnum } from "utils/enums";

export function idFromEphemeris(ephemeris: EphemerisFile): string {
  const { FILE } = ephemeris;
  return FILE;
}

export type EphemeraEntityState = EntityState<EphemerisFile> & {
  dayNight: DayNightObj[];
  metadata: ResMetadata;
  loadingStatus: LoadingStatusEnum;
};

const ephemerisAdapter = createEntityAdapter<EphemerisFile>({
  selectId: idFromEphemeris,
  // Keep the "all IDs" array sorted based on date descending
  sortComparer: (a, b) => diff(new Date(a.EPOCH), new Date(b.EPOCH)),
});

export const initialState: EphemeraEntityState = ephemerisAdapter.getInitialState({
  dayNight: [{ appSeconds: 0, daylight: false }],
  metadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
});

export const ephemeraSelectors = ephemerisAdapter.getSelectors<EphemeraEntityState>(
  (state) => state
);

export const ephemeraSlice = createSlice({
  name: "ephemera",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    addEphemera: (state, action: { payload: WrappedResponse<EphemerisStore> }) => {
      ephemerisAdapter.upsertMany(state, action.payload.data.ephemera);
      state.dayNight = action.payload.data.dayNight;
      state.metadata = { ...state.metadata, ...action.payload.metadata };
    },
    fetchError: (state, action: { payload: string }) => {
      state.metadata = { ...state.metadata, error: action.payload };
    },
    setEphemeraLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { addEphemera, fetchError, setEphemeraLoadingStatus } = ephemeraSlice.actions;

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
