import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialState: MaestroState = {
  crewAssignment: null,
  evaStartSec: null,
  processedActivitiesData: null,
  cacheMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
};

export const maestroSlice = createSlice({
  name: "maestro",
  initialState,
  reducers: {
    setMaestroData: (
      state,
      action: { payload: { maestroInternalAPIData: MaestroInternalAPIData } }
    ) => {
      state.processedActivitiesData = action.payload.maestroInternalAPIData.processedActivitiesData;
      state.crewAssignment = action.payload.maestroInternalAPIData.crew;
      state.evaStartSec = action.payload.maestroInternalAPIData.evaStartSec;
    },
    maestroFetchError: (state, action: { payload: string }) => {
      state.cacheMetadata = { ...state.cacheMetadata, error: action.payload };
    },
    setMaestroLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { setMaestroData, maestroFetchError, setMaestroLoadingStatus } = maestroSlice.actions;
