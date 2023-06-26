import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { useEffect, useState } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { setPaneStateValue } from "store/framework";
import { RootState } from "store/index";
import { getPlotlyChartLayout } from "./graphProperties";
import { setGraphsData, clearGraphsData } from "store/graphs";
import dynamic from "next/dynamic";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faExpandAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

library.add(faExpandAlt);

const DynPlotlyChart = dynamic(import("./plotly"), {
  ssr: false,
});

import styles from "./graph.module.css";
import { appSecondsFromDateString, dateFromAppSeconds } from "utils/formatting";
import fetchWithTimeout from "utils/fetch-with-timeout";
import { hasProp } from "utils/type-guards";
import Button from "components/interface/button";

export function GraphControls(props: { frameID: number; frameDimensions: number[] }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const minWidth = 500; // minimum width of the graph pane before shortening the dropdown

  const paneStateData: GraphPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData,
    shallowEqual
  );
  const graphs: Graph[] = useSelector(
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
              frameID={props.frameID}
              frameDimensions={props.frameDimensions}
              minWidth={minWidth}
            />
            <GraphDurationSelector frameID={props.frameID} paneStateData={paneStateData} />
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
}

function GraphSelectorDropdown(props: {
  frameID: number;
  frameDimensions: number[];
  minWidth: number;
}) {
  const paneStateData: GraphPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData,
    shallowEqual
  );
  const dispatch = useDispatch();
  const graphs: Graph[] = useSelector(
    (state: RootState) => state.graphs.graphsManifest?.graphs,
    shallowEqual
  );

  const dropDownWidthClass =
    props.frameDimensions[0] > props.minWidth
      ? styles.selectContainerWide
      : styles.selectContainerNarrow;

  const selectedGraphId = paneStateData.selectedGraphId || "";

  return (
    <div className={styles.controls}>
      <div className={`${styles.selectContainer} ${dropDownWidthClass}`} title="Select a graph">
        <select
          className={styles.selectActive}
          value={selectedGraphId}
          onChange={(event) => {
            setPaneStateValue(dispatch, props.frameID, "selectedGraphId", event.target.value);
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
          <FontAwesomeIcon icon="chevron-down" size="sm" />
        </div>
      </div>
    </div>
  );
}

const GraphDurationSelector = ({
  frameID,
  paneStateData,
}: {
  frameID: number;
  paneStateData: GraphPaneStateData;
}): JSX.Element => {
  const dispatch = useDispatch();
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

export default function Graph(props: { frameID: number; frameDimensions: number[] }) {
  const paneStateData: GraphPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData,
    shallowEqual
  );
  const graphs: GraphsState = useSelector((state: RootState) => state.graphs, shallowEqual);

  const [graphDataIsBad, setGraphDataIsBad] = useState<false | "unauthorized" | "invalid-data">(
    false
  );

  // get graph data where id matches selectedGraphId
  const selectedGraph = graphs.graphsManifest?.graphs.find(
    (graph) => graph.id === paneStateData.selectedGraphId
  );
  const graphData = selectedGraph?.data;

  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const playheadHover: PlayheadHoverState = useSelector((state: RootState) => state.playheadHover);

  const graphHeight = props.frameDimensions[1] - 40;

  const initialChartData = {
    plotlyChartTraces: null,
    plotlyChartLayout: getPlotlyChartLayout(graphHeight),
  };

  const initialChartProps = {
    frameID: props.frameID,
    plotIndexToHighlight: 0,
    chartData: initialChartData,
  };

  const [chartProps, setChartProps] = useState(initialChartProps);
  const [graphDataTimestampsInSeconds, setGraphDataTimestampsInSeconds] = useState<number[]>([]);

  const frameID = props.frameID;
  const dispatch = useDispatch();

  // Fetch the data for the selected graphId from the graph dataURL
  const localAsyncFetchData = async () => {
    try {
      const fetchOptions = graphs.graphsManifest.fetchOptions?.credentials
        ? {
            credentials: graphs.graphsManifest.fetchOptions?.credentials,
          }
        : {};

      const response = await fetchWithTimeout(
        graphs.graphsManifest?.sourceUrl + selectedGraph?.dataURL,
        fetchOptions
      );
      const data = await response.json();

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
    if (graphs.loadingStatus !== "loaded" || !paneStateData.selectedGraphId) return;

    setPaneStateValue(dispatch, frameID, "showHelp", false);

    dispatch(clearGraphsData());

    localAsyncFetchData();
  }, [paneStateData.selectedGraphId, graphs.loadingStatus]);

  // Peroiodically update the graph data depending on the graphs.graphManifest.updateFrequency value. If not value, default to 10 seconds. If -1 don't refresh.
  useEffect(() => {
    // don't refrech if updateFrequency is < 1
    if (
      graphs.loadingStatus !== "loaded" ||
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
  }, [graphs.loadingStatus, paneStateData.selectedGraphId]);

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

    const plotIndexToHighlight = findPlotIndexToHighlight(playhead.seconds);

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
  }, [graphData, props.frameDimensions]);

  // update the graph ranges and hover when the time changes
  useEffect(() => {
    if (!graphData) return;

    // create isoDate strings for the start and end times of the desired graph range
    let startDateString: string = null;
    let endDateString: string = null;
    if (paneStateData.durationSelection && paneStateData.durationSelection !== -1) {
      const duration = paneStateData.durationSelection;
      const halfDuration = duration / 2;

      const startSeconds = playhead.seconds - halfDuration;
      const endSeconds = playhead.seconds + halfDuration;

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
      playheadHover.seconds || playhead.seconds
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
      playheadHover.seconds || playhead.seconds
    );

    const updatedChartProps = {
      ...chartProps,
      plotIndexToHighlight,
    };

    setChartProps(updatedChartProps);
  }, [graphData, playheadHover]);

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
}
