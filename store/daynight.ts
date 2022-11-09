import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialState: DayNightState = {
  dayNight: [],
  cacheMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
  source: null,
};

export const dayNightSlice = createSlice({
  name: "daynight",
  initialState,
  reducers: {
    /** Add new day night to the store */
    addDayNight: (state, action: { payload: WrappedResponse<DayNightStore> }) => {
      state.cacheMetadata = { ...state.cacheMetadata, ...action.payload.cacheMetadata };
      state.dayNight = action.payload.data.dayNight;
      state.source = action.payload.source;
    },
    clearDayNight: (state) => {
      state.dayNight = [];
      state.cacheMetadata = null;
      state.loadingStatus = LoadingStatusEnum.LOADING;
      state.source = null;
    },
    fetchError: (state, action: { payload: string }) => {
      state.cacheMetadata = { ...state.cacheMetadata, error: action.payload };
    },
    setDayNightLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { addDayNight, clearDayNight, fetchError, setDayNightLoadingStatus } =
  dayNightSlice.actions;
