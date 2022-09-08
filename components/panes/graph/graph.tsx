import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setPaneStateValue } from "store/framework";
import { RootState } from "store/index";
import { getPlotlyChartLayout, parseGandalfHeartrateDataFile } from "utils/graphs";
import dynamic from "next/dynamic";

const DynPlotlyChart = dynamic(import("./plotly"), {
  ssr: false,
});

import styles from "./graph.module.css";
import { appSecondsFromDateString } from "utils/formatting";

export function GraphControls(props: { frameID: number }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

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
        {graphs.graphsManifest && <div>Selected Graph id: {paneStateData.selectedGraphId}</div>}
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

export default function Graph(props: { frameID: number; frameDimensions: number[] }) {
  const paneStateData: GraphPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  const graphs: GraphsState = useSelector((state: RootState) => state.graphs);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const playheadHover: PlayheadHoverState = useSelector((state: RootState) => state.playheadHover);

  const graphHeight = props.frameDimensions[1] - 40;

  const initialChartData = {
    plotlyChartTraces: null,
    plotlyChartLayout: getPlotlyChartLayout(graphHeight),
  };

  const initialChartProps = {
    plotIndexToHighlight: 0,
    chartData: initialChartData,
  };

  const [heartrateData, setHeartratehData] = useState<HeartrateData[]>(null);
  const [chartProps, setChartProps] = useState(initialChartProps);

  const frameID = props.frameID;
  const dispatch = useDispatch();

  useEffect(() => {
    if (!graphs.graphsManifest || !paneStateData.selectedGraphId) {
      return;
    }

    // Get the graph for the selected graphId
    const graph = graphs.graphsManifest.graphs.find((g) => g.id === paneStateData.selectedGraphId);
    if (!graph) {
      return;
    }

    // Fetch the data for the selected graphId from the graph dataURL
    const localAsyncFetchData = async () => {
      const response = await fetch(graphs.graphsManifest.sourceUrl + graph.dataURL);
      const data = await response.text();
      setHeartratehData(parseGandalfHeartrateDataFile(data, playhead.date.split("T")[0]));
    };

    localAsyncFetchData();
  }, [graphs.graphsManifest]);

  useEffect(() => {
    if (!heartrateData) {
      return;
    }

    const chartTrace: PlotlyChartTrace = {
      x: heartrateData.map((a) => a.timestamp),
      y: heartrateData.map((a) => a.heartrate),
      type: "scatter",
      mode: "lines",
      line: {
        color: "#B7AC0B",
      },
      name: "test",
    };

    let plotIndexToHighlight = 0;

    //find the telemetry plotpoint closest to the current playhead time by comparing against the plot timestamps
    for (let i = 0; i < heartrateData.length; i++) {
      const indexAppSeconds = appSecondsFromDateString(heartrateData[i].timestamp);
      const secondsToHighlight =
        playheadHover.seconds !== 0 ? playheadHover.seconds : playhead.seconds;
      if (indexAppSeconds > secondsToHighlight) {
        break;
      }
      plotIndexToHighlight = i;
    }

    setChartProps({
      plotIndexToHighlight,
      chartData: {
        plotlyChartTraces: [chartTrace],
        plotlyChartLayout: getPlotlyChartLayout(graphHeight),
      },
    });
  }, [heartrateData, playhead.seconds, playheadHover.seconds]);

  return (
    <div className={styles.main}>
      {graphs.graphsManifest && <div>Heart Rate</div>}
      <div style={{ width: "100%" }}>
        {graphs.graphsManifest && <DynPlotlyChart {...chartProps}></DynPlotlyChart>}
      </div>

      <HelpOverlay
        isModalOpen={paneStateData.showHelp}
        closeHandler={() => {
          setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
        }}
      >
        <div>
          <p>Displays a line graph of data available for the selected event.</p>
        </div>
      </HelpOverlay>
    </div>
  );
}
