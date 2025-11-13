import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { FunctionComponent, useEffect, useState } from "react";
import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { setPaneStateValue } from "store/framework";
import { RootState } from "store/index";
import { ChartLayout, getPlotlyChartLayout } from "./graphProperties";
import { setGraphsData, clearGraphsData } from "store/graphs";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import DynPlotlyChart from "./plotly";

import styles from "./graph.module.css";
import { appSecondsFromDateString, dateFromAppSeconds } from "utils/formatting";
import { hasProp } from "utils/type-guards";
import Button from "components/interface/button";
import { usePlayheadContext } from "store/contextProviders/playheadContext";
import { useHoverPlayheadContext } from "store/contextProviders/hoverPlayheadContext";

export const GraphControls: FunctionComponent<{ frameID: number; frameDimensions: number[] }> = ({
  frameID,
  frameDimensions,
}) => {
  const dispatch = useAppDispatch();

  const minWidth = 500; // minimum width of the graph pane before shortening the dropdown

  const paneStateData: GraphPaneStateData = useAppSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData,
    shallowEqual
  );
  const graphs: Graph[] = useAppSelector(
    (state: RootState) => state.graphs.graphsManifest?.graphs,
    shallowEqual
  );

  useEffect(() => {
    if (!graphs && !paneStateData.showHelp) {
      setPaneStateValue(dispatch, frameID, "showHelp", true);
    } else {
      setPaneStateValue(dispatch, frameID, "showHelp", false);
    }
  }, [graphs]);

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}>
        {graphs && (
          <>
            <GraphSelectorDropdown
              frameID={frameID}
              frameDimensions={frameDimensions}
              minWidth={minWidth}
            />
            <GraphDurationSelector frameID={frameID} paneStateData={paneStateData} />
          </>
        )}
      </div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => {
              setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
            }}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
};

const GraphSelectorDropdown: FunctionComponent<{
  frameID: number;
  frameDimensions: number[];
  minWidth: number;
}> = ({ frameID, frameDimensions, minWidth }) => {
  const paneStateData: GraphPaneStateData = useAppSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData,
    shallowEqual
  );
  const dispatch = useAppDispatch();
  const graphs: Graph[] = useAppSelector(
    (state: RootState) => state.graphs.graphsManifest?.graphs,
    shallowEqual
  );

  const dropDownWidthClass =
    frameDimensions[0] > minWidth ? styles.selectContainerWide : styles.selectContainerNarrow;

  const selectedGraphId = paneStateData.selectedGraphId || "";

  return (
    <div className={styles.controls}>
      <div className={`${styles.selectContainer} ${dropDownWidthClass}`} title="Select a graph">
        <select
          className={styles.selectActive}
          value={selectedGraphId}
          onChange={(event) => {
            setPaneStateValue(dispatch, frameID, "selectedGraphId", event.target.value);
          }}
        >
          <option value="">Select a graph</option>
          {graphs.map((graph) => {
            return (
              <option key={graph.id} value={graph.id}>
                {graph.title}
              </option>
            );
          })}
        </select>
        <div className={styles.select_arrow}>
          <FontAwesomeIcon icon={faChevronDown} size="sm" />
        </div>
      </div>
    </div>
  );
};

const GraphDurationSelector: FunctionComponent<{
  frameID: number;
  paneStateData: GraphPaneStateData;
}> = ({ frameID, paneStateData }) => {
  const dispatch = useAppDispatch();
  interface GraphDurationSelectItem {
    value: number;
    label: string;
  }
  const durationItems: GraphDurationSelectItem[] = [
    { value: -1, label: "All" },
    { value: 3600, label: "1h" },
    { value: 600, label: "10m" },
    { value: 300, label: "5m" },
  ];

  const durationSelection = paneStateData?.durationSelection || -1;

  return (
    <div className={styles.durationItemsContainer}>
      {durationItems.map((item, index) => {
        let rounded = "none";
        if (index === 0) {
          rounded = "left";
        } else if (index === durationItems.length - 1) {
          rounded = "right";
        }

        let color = "active";
        if (durationSelection === item.value) {
          color = "active_selected";
        }

        return (
          <Button
            key={"DLBUTTON_" + item.label + "_" + frameID}
            color={color}
            size="medium"
            rounded={rounded}
            callback={() => {
              setPaneStateValue(dispatch, frameID, "durationSelection", item.value);
            }}
          >
            <div className={styles.dlLabel}>{item.label}</div>
          </Button>
        );
      })}
    </div>
  );
};

const Graph: FunctionComponent<{ frameID: number; frameDimensions: number[] }> = ({
  frameID,
  frameDimensions,
}) => {
  const paneStateData: GraphPaneStateData = useAppSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData,
    shallowEqual
  );
  const graphs: GraphsState = useAppSelector((state: RootState) => state.graphs, shallowEqual);

  const [graphDataIsBad, setGraphDataIsBad] = useState<false | "unauthorized" | "invalid-data">(
    false
  );

  // get graph data where id matches selectedGraphId
  const selectedGraph = graphs.graphsManifest?.graphs.find(
    (graph) => graph.id === paneStateData.selectedGraphId
  );
  const graphData = selectedGraph?.data;

  const graphHeight = frameDimensions[1] - 40;

  const initialChartData: {
    plotlyChartTraces: PlotlyChartTrace[];
    plotlyChartLayout: ChartLayout;
  } = {
    plotlyChartTraces: null,
    plotlyChartLayout: getPlotlyChartLayout(graphHeight),
  };

  const initialChartProps = {
    frameID,
    plotIndexToHighlight: 0,
    chartData: initialChartData,
  };

  const [chartProps, setChartProps] = useState(initialChartProps);
  const [graphDataTimestampsInSeconds, setGraphDataTimestampsInSeconds] = useState<number[]>([]);
  const { playhead } = usePlayheadContext();
  const { hoverPlayhead } = useHoverPlayheadContext();

  const dispatch = useAppDispatch();

  // Fetch the data for the selected graphId from the graph dataURL
  const localAsyncFetchData = async () => {
    if (!graphs.graphsManifest) return;
    try {
      const fetchOptions = graphs.graphsManifest.fetchOptions?.credentials
        ? {
            credentials: graphs.graphsManifest.fetchOptions?.credentials,
          }
        : {};
      const response = await fetch(
        graphs.graphsManifest.sourceUrl + selectedGraph?.dataURL,
        fetchOptions
      );
      const data = (await response.json()) as GraphData[];

      const timestampsInSeconds = data.map((item: GraphData) =>
        appSecondsFromDateString(item.timestamp)
      );
      setGraphDataTimestampsInSeconds(timestampsInSeconds);

      // Store the data in the graph manifest in the store
      dispatch(
        setGraphsData({
          graphId: paneStateData.selectedGraphId,
          graphData: data,
        })
      );
    } catch (error) {
      console.log("Error fetching graph data", error);
    }
  };

  // Trigger loading of graph data when selectedGraphId changes
  useEffect(() => {
    if (graphs.metadata === null || !paneStateData.selectedGraphId) return;

    setPaneStateValue(dispatch, frameID, "showHelp", false);

    dispatch(clearGraphsData());

    localAsyncFetchData();
  }, [paneStateData.selectedGraphId, graphs.metadata]);

  // Peroiodically update the graph data depending on the graphs.graphManifest.updateFrequency value. If not value, default to 10 seconds. If -1 don't refresh.
  useEffect(() => {
    // don't refrech if updateFrequency is < 1
    if (
      graphs.metadata === null ||
      !paneStateData.selectedGraphId ||
      graphs.graphsManifest?.updateFrequency < 1
    )
      return;

    // default to 10 seconds if no updateFrequency value in manifest
    const updateFrequency = graphs.graphsManifest?.updateFrequency || 10;

    const interval = setInterval(() => {
      localAsyncFetchData();
    }, updateFrequency * 1000);

    return () => clearInterval(interval);
  }, [graphs.metadata, paneStateData.selectedGraphId]);

  const findPlotIndexToHighlight = (seconds: number): number => {
    let plotIndexToHighlight = 0;
    //find the telemetry index in graphDataTimestampsSecondsSubset closest to the current playhead time
    for (let i = 0; i < graphDataTimestampsInSeconds.length; i++) {
      if (graphDataTimestampsInSeconds[i] >= seconds) {
        break;
      }
      plotIndexToHighlight = i;
    }

    return plotIndexToHighlight;
  };

  // Trigger updating of chart data when graph data changes
  useEffect(() => {
    if (!graphData) return;

    if (!Array.isArray(graphData)) {
      const badData = graphData as unknown;
      if (hasProp(badData, "authorized") && badData.authorized === false) {
        console.error("Unauthorized graph data:", { graphData });
        setGraphDataIsBad("unauthorized");
      } else {
        console.error("graphData not an array. Received:", { graphData });
        setGraphDataIsBad("invalid-data");
      }
      return;
    }

    const chartTrace: PlotlyChartTrace = {
      x: graphData.map((a) => a.timestamp),
      y: graphData.map((a) => a.value),
      type: "scatter",
      mode: "lines",
      line: {
        color: "#B7AC0B",
      },
      name: "test",
    };

    const plotIndexToHighlight = findPlotIndexToHighlight(playhead.appSeconds);

    const chartLayout = getPlotlyChartLayout(graphHeight);

    setTimeout(() => {
      // delay 500ms before updating chart to allow for the chart to be rendered
      setChartProps({
        frameID,
        plotIndexToHighlight,
        chartData: {
          plotlyChartTraces: [chartTrace],
          plotlyChartLayout: chartLayout,
        },
      });
    }, 500);
  }, [graphData, frameDimensions]);

  // update the graph ranges and hover when the time changes
  useEffect(() => {
    if (!graphData) return;

    // create isoDate strings for the start and end times of the desired graph range
    let startDateString: string = null;
    let endDateString: string = null;
    if (paneStateData.durationSelection && paneStateData.durationSelection !== -1) {
      const duration = paneStateData.durationSelection;
      const halfDuration = duration / 2;

      const startSeconds = playhead.appSeconds - halfDuration;
      const endSeconds = playhead.appSeconds + halfDuration;

      startDateString = dateFromAppSeconds(startSeconds, playhead.date).toISOString();
      endDateString = dateFromAppSeconds(endSeconds, playhead.date).toISOString();
    }

    const chartLayout = getPlotlyChartLayout(graphHeight);

    if (startDateString && endDateString) {
      chartLayout.xaxis.autorange = false;
      chartLayout.xaxis.range = [startDateString, endDateString];
    } else {
      chartLayout.xaxis.autorange = true;
      chartLayout.xaxis.range = null;
    }

    const plotIndexToHighlight = findPlotIndexToHighlight(
      hoverPlayhead.hoverSeconds || playhead.appSeconds
    );

    const updatedChartProps = {
      ...chartProps,
      plotIndexToHighlight,
      chartData: {
        ...chartProps.chartData,
        plotlyChartLayout: chartLayout,
      },
    };

    setChartProps(updatedChartProps);
  }, [graphData, paneStateData.durationSelection, playhead]);

  // handle hover over graph
  useEffect(() => {
    if (!graphData) return;

    const plotIndexToHighlight = findPlotIndexToHighlight(
      hoverPlayhead.hoverSeconds || playhead.appSeconds
    );

    const updatedChartProps = {
      ...chartProps,
      plotIndexToHighlight,
    };

    setChartProps(updatedChartProps);
  }, [graphData, playhead, hoverPlayhead]);

  if (graphDataIsBad === "unauthorized") {
    return <div>Unauthorized</div>;
  } else if (graphDataIsBad === "invalid-data") {
    return <div>Invalid graph data</div>;
  }

  return (
    <div className={styles.main}>
      {selectedGraph && <div>{selectedGraph?.title}</div>}
      <div style={{ width: "100%" }}>
        {selectedGraph && <DynPlotlyChart {...chartProps}></DynPlotlyChart>}
      </div>

      <HelpOverlay
        isModalOpen={paneStateData.showHelp}
        closeHandler={() => {
          setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
        }}
      >
        <div>
          <p>
            Displays a line graph if data is available for the selected source on the selected date.
          </p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default Graph;
