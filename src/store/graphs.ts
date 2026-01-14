import { createSlice } from "@reduxjs/toolkit";

export const initialState: GraphsState = {
  graphsManifest: null,
  metadata: null,
};

export const graphSlice = createSlice({
  name: "graphs",
  initialState,
  reducers: {
    /** Add new graph manifest to the store */
    setGraphsManifest: (state, action: { payload: FetchResponse<GraphsManifest | null> }) => {
      state.graphsManifest = action.payload.data;
      state.metadata = action.payload.fetchMetadata;
    },
    clearGraphsManifest: (state) => {
      state.graphsManifest = null;
      state.metadata = null;
    },
    setGraphsData: (state, action: { payload: { graphId: string; graphData: GraphData[] } }) => {
      if (!state.graphsManifest) return;
      const graph = state.graphsManifest.graphs.find((g) => g.id === action.payload.graphId);
      if (!graph) return;
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
        return { ...stateGraph, data: undefined };
      });
    },
    graphsFetchError: (state, action: { payload: string }) => {
      state.metadata = {
        success: false,
        error: action.payload,
        timestamp: state.metadata?.timestamp || new Date().toISOString(),
      };
    },
  },
});

export const {
  setGraphsManifest,
  clearGraphsManifest,
  setGraphsData,
  clearGraphsData,
  graphsFetchError,
} = graphSlice.actions;
