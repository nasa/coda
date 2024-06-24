import { createSlice } from "@reduxjs/toolkit";

export const initialState: MaestroState = {
  title: null,
  crewAssignment: null,
  evaStartSec: null,
  evaEndSec: null,
  evaDurationSec: null,
  processedActivitiesData: null,
  responseMetadata: null,
  loadingStatus: "loading",
};

export const maestroSlice = createSlice({
  name: "maestro",
  initialState,
  reducers: {
    setMaestroData: (
      state,
      action: { payload: { maestroInternalAPIData: MaestroInternalAPIData } }
    ) => {
      state.title = action.payload.maestroInternalAPIData.title;
      state.processedActivitiesData = action.payload.maestroInternalAPIData.processedActivitiesData;
      state.crewAssignment = action.payload.maestroInternalAPIData.crew;
      state.evaStartSec = action.payload.maestroInternalAPIData.evaStartSec;
      state.evaEndSec = action.payload.maestroInternalAPIData.evaEndSec;
      state.evaDurationSec = action.payload.maestroInternalAPIData.evaDurationSec;
    },
    maestroFetchError: (state, action: { payload: string }) => {
      state.responseMetadata = { ...state.responseMetadata, error: action.payload };
    },
    setMaestroLoadingStatus: (state, action: { payload: LoadingStatus }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { setMaestroData, maestroFetchError, setMaestroLoadingStatus } = maestroSlice.actions;
