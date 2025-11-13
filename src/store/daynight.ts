import { createSlice } from "@reduxjs/toolkit";

export const initialState: DayNightState = {
  dayNight: [],
  metadata: null,
  source: null,
};

export const dayNightSlice = createSlice({
  name: "daynight",
  initialState,
  reducers: {
    /** Add new day night to the store */
    addDayNight: (state, action: { payload: FetchResponse<DayNightStore> }) => {
      state.dayNight = action.payload.data?.dayNight || [];
      state.metadata = action.payload.fetchMetadata;
      state.source = action.payload.source;
    },
    clearDayNight: (state) => {
      state.dayNight = [];
      state.metadata = null;
      state.source = null;
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

export const { addDayNight, clearDayNight, fetchError } = dayNightSlice.actions;
