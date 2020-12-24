import { createSlice } from "@reduxjs/toolkit";
import { EVASummaryResponse, ParsedEVADetails } from "services/iss-wiki";

export interface EVAsState {
  initialized: Boolean;
  selectedEVA: string;
  allEVAs: EVASummaryResponse;
  gEVADetails: ParsedEVADetails;
}

export const initialState: EVAsState = {
  initialized: false,
  selectedEVA: "",
  allEVAs: null,
  gEVADetails: null,
};

export const evasSlice = createSlice({
  name: "evas",
  initialState,
  reducers: {
    initialize: (state, action) => {
      state.initialized = true;
      state.allEVAs = action.payload.allEVAs;
      // TODO: should we key gEVADetails by EVA name?
      state.gEVADetails = action.payload.gEVADetails;
    },
  },
});

export const { initialize } = evasSlice.actions;
