import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialState: GraphsState = {
  graphsManifest: null,
  cacheMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
};

export const graphSlice = createSlice({
  name: "graphs",
  initialState,
  reducers: {
    /** Add new graph manifest to the store */
    setGraphsManifest: (state, action: { payload: WrappedResponse<GraphsManifest> }) => {
      state.graphsManifest = action.payload.data;
      state.cacheMetadata = { ...state.cacheMetadata, ...action.payload.cacheMetadata };
    },
    clearGraphsManifest: (state) => {
      state.graphsManifest = null;
      state.cacheMetadata = null;
      state.loadingStatus = LoadingStatusEnum.LOADING;
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
    clearGraphsData: (state, action: { payload: { graphId: string } }) => {
      const graph = state.graphsManifest?.graphs.find((g) => g.id === action.payload.graphId);
      graph.data = null;
      state.graphsManifest.graphs = state.graphsManifest.graphs.map((stateGraph) => {
        if (stateGraph.id === graph.id) {
          return graph;
        } else {
          return stateGraph;
        }
      });
    },
    graphsFetchError: (state, action: { payload: string }) => {
      state.cacheMetadata = { ...state.cacheMetadata, error: action.payload };
    },
    setGraphsLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
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
