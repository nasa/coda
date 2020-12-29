import { createSelector, createSlice } from "@reduxjs/toolkit";
import { EVA, EVASummaryResponse, ParsedEVADetails } from "services/iss-wiki";

export interface EVAsState {
  /** Keyed in the format of underscored lowercase EVA name, eg. `us_eva_55` */
  EVAs: { [key: string]: EVA };
  /** Format of underscored lowercase EVA name, eg. `us_eva_55` */
  selectedEVA: string;
}

export const initialState: EVAsState = {
  EVAs: {},
  selectedEVA: "",
};

export const evasSlice = createSlice({
  name: "evas",
  initialState,
  reducers: {},
});

// export const { initialize } = evasSlice.actions;

export const selectEVAStartMilliseconds = createSelector(
  (state: EVAsState) => state.EVAs[state.selectedEVA],
  (eva) => {
    const { startDate, startTime } = eva;
    const [Y, M, D] = startDate.split("/").map(Number);
    const [hh, mm] = startTime.split(/:/).map(Number);
    return Date.UTC(Y, M - 1, D, hh, mm);
  }
);
