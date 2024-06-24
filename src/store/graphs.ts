import { createSlice } from "@reduxjs/toolkit";

export const initialState: GraphsState = {
  graphsManifest: null,
  responseMetadata: null,
  loadingStatus: "loading",
};

export const graphSlice = createSlice({
  name: "graphs",
  initialState,
  reducers: {
    /** Add new graph manifest to the store */
    setGraphsManifest: (state, action: { payload: WrappedResponse<GraphsManifest> }) => {
      state.graphsManifest = action.payload.data;
      state.responseMetadata = { ...state.responseMetadata, ...action.payload.responseMetadata };
    },
    clearGraphsManifest: (state) => {
      state.graphsManifest = null;
      state.responseMetadata = null;
      state.loadingStatus = "loading";
    },
    setGraphsData: (state, action: { payload: { graphId: string; graphData: GraphData[] } }) => {
      const graph = state.graphsManifest?.graphs.find((g) => g.id === action.payload.graphId);
      graph.data = action.payload.graphData;
      state.graphsManifest.graphs = state.graphsManifest.graphs.map((stateGraph) => {
        if (stateGraph.id === graph.id) {
          return graph;
        } else {
          return stateGraph;
        }
      });
    },
    clearGraphsData: (state) => {
      if (!state.graphsManifest) return;
      state.graphsManifest.graphs = state.graphsManifest.graphs.map((stateGraph) => {
        return { ...stateGraph, data: null };
      });
    },
    graphsFetchError: (state, action: { payload: string }) => {
      state.responseMetadata = { ...state.responseMetadata, error: action.payload };
    },
    setGraphsLoadingStatus: (state, action: { payload: LoadingStatus }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const {
  setGraphsManifest,
  clearGraphsManifest,
  setGraphsData,
  clearGraphsData,
  graphsFetchError,
  setGraphsLoadingStatus,
} = graphSlice.actions;
