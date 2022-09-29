import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setPaneStateValue } from "store/framework";
import { RootState } from "store/index";
import { getPlotlyChartLayout } from "utils/graphs";
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
import { appSecondsFromDateString } from "utils/formatting";

export function GraphControls(props: { frameID: number; frameDimensions: number[] }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const minWidth = 527; // minimum width of the graph pane before shortening the dropdown

  const paneStateData: GraphPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  const graphs: GraphsState = useSelector((state: RootState) => state.graphs);

  useEffect(() => {
    if (!graphs.graphsManifest && !paneStateData.showHelp) {
      setPaneStateValue(dispatch, frameID, "showHelp", true);
    } else {
      setPaneStateValue(dispatch, frameID, "showHelp", false);
    }
  }, [graphs]);

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}>
        {graphs.graphsManifest && (
          <div>
            <GraphSelectorDropdown />
          </div>
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

  function GraphSelectorDropdown() {
    const dropDownWidthClass =
      props.frameDimensions[0] > minWidth
        ? styles.selectContainerWide
        : styles.selectContainerNarrow;

    return (
      <div className={styles.controls}>
        <div className={`${styles.selectContainer} ${dropDownWidthClass}`} title="Select a graph">
          <select
            className={styles.selectActive}
            value={paneStateData.selectedGraphId}
            onChange={(event) => {
              console.log("Graph dropdown changed");
              setPaneStateValue(dispatch, frameID, "selectedGraphId", event.target.value);
            }}
          >
            <option value="">Select a graph</option>
            {graphs.graphsManifest.graphs.map((graph) => {
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
}

export default function Graph(props: { frameID: number; frameDimensions: number[] }) {
  const paneStateData: GraphPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  const graphs: GraphsState = useSelector((state: RootState) => state.graphs);

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

  const frameID = props.frameID;
  const dispatch = useDispatch();

  // Fetch the data for the selected graphId from the graph dataURL
  const localAsyncFetchData = async () => {
    const response = await fetch(graphs.graphsManifest.sourceUrl + selectedGraph.dataURL);
    const data = await response.json();

    // Store the data in the graph manifest in the store
    dispatch(
      setGraphsData({
        graphId: paneStateData.selectedGraphId,
        graphData: data,
      })
    );
  };

  // Trigger loading of graph data when selectedGraphId changes
  useEffect(() => {
    if (graphs.loadingStatus !== "loaded" || !paneStateData.selectedGraphId) {
      return;
    }
    setPaneStateValue(dispatch, frameID, "showHelp", false);

    dispatch(clearGraphsData());

    localAsyncFetchData();
  }, [paneStateData.selectedGraphId]);

  // Trigger updating of chart data when graph data changes
  useEffect(() => {
    if (!graphData) {
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

    let plotIndexToHighlight = 0;

    setChartProps({
      frameID,
      plotIndexToHighlight,
      chartData: {
        plotlyChartTraces: [chartTrace],
        plotlyChartLayout: getPlotlyChartLayout(graphHeight),
      },
    });
  }, [graphData]);

  // Set the playhead position on the graph
  useEffect(() => {
    if (!graphData) {
      return;
    }

    let plotIndexToHighlight = 0;
    //find the telemetry plotpoint closest to the current playhead time by comparing against the plot timestamps
    for (let i = 0; i < graphData.length; i++) {
      const indexAppSeconds = appSecondsFromDateString(graphData[i].timestamp);
      const secondsToHighlight =
        playheadHover.seconds !== 0 ? playheadHover.seconds : playhead.seconds;
      if (indexAppSeconds > secondsToHighlight) {
        break;
      }
      plotIndexToHighlight = i;
    }

    setChartProps({ ...chartProps, plotIndexToHighlight });
  }, [playhead.seconds, playheadHover.seconds]);

  return (
    <div className={styles.main}>
      {paneStateData.selectedGraphId && <div>{selectedGraph?.title}</div>}
      <div style={{ width: "100%" }}>
        {paneStateData.selectedGraphId && <DynPlotlyChart {...chartProps}></DynPlotlyChart>}
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
