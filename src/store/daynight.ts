import { createSlice } from "@reduxjs/toolkit";

export const initialState: DayNightState = {
  dayNight: [],
  responseMetadata: null,
  loadingStatus: "loading",
  source: null,
};

export const dayNightSlice = createSlice({
  name: "daynight",
  initialState,
  reducers: {
    /** Add new day night to the store */
    addDayNight: (state, action: { payload: WrappedResponse<DayNightStore> }) => {
      state.responseMetadata = { ...state.responseMetadata, ...action.payload.responseMetadata };
      state.dayNight = action.payload.data.dayNight;
      state.source = action.payload.source;
    },
    clearDayNight: (state) => {
      state.dayNight = [];
      state.responseMetadata = null;
      state.loadingStatus = "loading";
      state.source = null;
    },
    fetchError: (state, action: { payload: string }) => {
      state.responseMetadata = { ...state.responseMetadata, error: action.payload };
    },
    setDayNightLoadingStatus: (state, action: { payload: LoadingStatus }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { addDayNight, clearDayNight, fetchError, setDayNightLoadingStatus } =
  dayNightSlice.actions;
