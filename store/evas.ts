import { createSlice } from "@reduxjs/toolkit";
import { EVA, EVASummaryResponse, ParsedEVADetails } from "services/iss-wiki";

export interface EVAsState {
  EVAs: { [key: string]: EVA };
  selectedEVA: string;
  allEVAs: EVASummaryResponse;
  evaDetails: ParsedEVADetails;
}

export const initialState: EVAsState = {
  EVAs: {},
  selectedEVA: "",
  allEVAs: null,
  gEVADetails: null,
};

export const evasSlice = createSlice({
  name: "evas",
  initialState,
  reducers: {
    initialize: (state, action) => {
      state.allEVAs = action.payload.allEVAs;
      // TODO: should we key gEVADetails by EVA name?
      state.gEVADetails = action.payload.gEVADetails;
    },
  },
});

export const { initialize } = evasSlice.actions;
