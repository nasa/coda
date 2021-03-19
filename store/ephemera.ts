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
      ephemerisAdapter.upsertMany(state, action);
      state.errorMessage = "";
    },
    fetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { addEphemera, fetchError } = ephemeraSlice.actions;
