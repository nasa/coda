import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { FunctionComponent, useEffect, useState } from "react";
import { refEqual, shallowEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { setPaneStateDataValue } from "store/framework";
import { ChartLayout, getPlotlyChartLayout } from "./graphProperties";
import { setGraphsData, clearGraphsData } from "store/graphs";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import DynPlotlyChart from "./plotly";

import styles from "./graph.module.css";
import { appSecondsFromDateString, dateFromAppSeconds } from "utils/formatting";
import { usePlayheadDate } from "store/hooks";

import Button, { type ColorVariant, type RoundedVariant } from "components/interface/button";
import ClockInterval from "components/framework/ClockInterval";

export const GraphControls: FunctionComponent<{
  paneInstanceId: number;
  frameDimensions: number[];
}> = ({ paneInstanceId, frameDimensions }) => {
  const dispatch = useAppDispatch();

  const minWidth = 500; // minimum width of the graph pane before shortening the dropdown

  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as GraphPaneStateData,
    shallowEqual
  );
  const graphs: Graph[] | undefined = useAppSelector(
    (state) => state.graphs.graphsManifest?.graphs,
    shallowEqual
  );

  useEffect(() => {
    if (!graphs && !paneStateData.showHelp) {
      dispatch(
        setPaneStateDataValue({
          paneInstanceId,
          paneStateProperty: "showHelp",
          paneStateValue: true,
        })
      );
    } else {
      dispatch(
        setPaneStateDataValue({
          paneInstanceId,
          paneStateProperty: "showHelp",
          paneStateValue: false,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch/paneInstanceId are stable, paneStateData.showHelp would cause loops
  }, [graphs]);

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}>
        {graphs && (
          <>
            <GraphSelectorDropdown
              paneInstanceId={paneInstanceId}
              frameDimensions={frameDimensions}
              minWidth={minWidth}
            />
            <GraphDurationSelector paneInstanceId={paneInstanceId} paneStateData={paneStateData} />
          </>
        )}
      </div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => {
              dispatch(
                setPaneStateDataValue({
                  paneInstanceId,
                  paneStateProperty: "showHelp",
                  paneStateValue: !paneStateData.showHelp,
                })
              );
            }}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
};

const GraphSelectorDropdown: FunctionComponent<{
  paneInstanceId: number;
  frameDimensions: number[];
  minWidth: number;
}> = ({ paneInstanceId, frameDimensions, minWidth }) => {
  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as GraphPaneStateData,
    shallowEqual
  );
  const dispatch = useAppDispatch();
  const graphs: Graph[] | undefined = useAppSelector(
    (state) => state.graphs.graphsManifest?.graphs,
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
            dispatch(
              setPaneStateDataValue({
                paneInstanceId,
                paneStateProperty: "selectedGraphId",
                paneStateValue: event.target.value,
              })
            );
          }}
        >
          <option value="">Select a graph</option>
          {graphs?.map((graph) => {
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
  paneInstanceId: number;
  paneStateData: GraphPaneStateData;
}> = ({ paneInstanceId, paneStateData }) => {
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
        let rounded: RoundedVariant = "none";
        if (index === 0) {
          rounded = "left";
        } else if (index === durationItems.length - 1) {
          rounded = "right";
        }

        let color: ColorVariant = "active";
        if (durationSelection === item.value) {
          color = "active_selected";
        }

        return (
          <Button
            key={"DLBUTTON_" + item.label + "_" + paneInstanceId}
            color={color}
            size="medium"
            rounded={rounded}
            callback={() => {
              dispatch(
                setPaneStateDataValue({
                  paneInstanceId,
                  paneStateProperty: "durationSelection",
                  paneStateValue: item.value,
                })
              );
            }}
          >
            <div className={styles.dlLabel}>{item.label}</div>
          </Button>
        );
      })}
    </div>
  );
};

const Graph: FunctionComponent<{ paneInstanceId: number; frameDimensions: number[] }> = ({
  paneInstanceId,
  frameDimensions,
}) => {
  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as GraphPaneStateData,
    shallowEqual
  );
  const graphs: GraphsState = useAppSelector((state) => state.graphs, shallowEqual);

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
    plotlyChartTraces: [],
    plotlyChartLayout: getPlotlyChartLayout(graphHeight),
  };

  const initialChartProps = {
    paneInstanceId,
    plotIndexToHighlight: 0,
    chartData: initialChartData,
  };

  const [chartProps, setChartProps] = useState(initialChartProps);
  const [graphDataTimestampsInSeconds, setGraphDataTimestampsInSeconds] = useState<number[]>([]);

  // Clock state from Redux
  const playheadDate = usePlayheadDate();
  const hoverSeconds = useAppSelector((state) => state.clock.hoverSeconds, refEqual);
  const [appSeconds, setLocalAppSeconds] = useState(0);

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

    dispatch(
      setPaneStateDataValue({
        paneInstanceId,
        paneStateProperty: "showHelp",
        paneStateValue: false,
      })
    );

    dispatch(clearGraphsData());

    localAsyncFetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch/paneInstanceId are stable, localAsyncFetchData changes on every render
  }, [paneStateData.selectedGraphId, graphs.metadata]);

  // Peroiodically update the graph data depending on the graphs.graphManifest.updateFrequency value. If not value, default to 10 seconds. If -1 don't refresh.
  useEffect(() => {
    // don't refrech if updateFrequency is < 1
    if (
      graphs.metadata === null ||
      !paneStateData.selectedGraphId ||
      (graphs.graphsManifest?.updateFrequency !== undefined &&
        graphs.graphsManifest.updateFrequency < 1)
    )
      return;

    // default to 10 seconds if no updateFrequency value in manifest
    const updateFrequency = graphs.graphsManifest?.updateFrequency || 10;

    const interval = setInterval(() => {
      localAsyncFetchData();
    }, updateFrequency * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- localAsyncFetchData changes on every render; graphs.graphsManifest?.updateFrequency is part of graphs.metadata and doesn't change independently
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
      if (
        typeof badData === "object" &&
        badData !== null &&
        "authorized" in badData &&
        (badData as Record<string, unknown>).authorized === false
      ) {
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

    const plotIndexToHighlight = findPlotIndexToHighlight(appSeconds);

    const chartLayout = getPlotlyChartLayout(graphHeight);

    setTimeout(() => {
      // delay 500ms before updating chart to allow for the chart to be rendered

      setChartProps({
        paneInstanceId,
        plotIndexToHighlight,
        chartData: {
          plotlyChartTraces: [chartTrace],
          plotlyChartLayout: chartLayout,
        },
      });
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appSeconds, findPlotIndexToHighlight, paneInstanceId, graphHeight are stable or would cause excessive re-renders
  }, [graphData, frameDimensions]);

  // update the graph ranges and hover when the time changes
  useEffect(() => {
    if (!graphData || !playheadDate) return;

    // create isoDate strings for the start and end times of the desired graph range
    let startDateString: string | undefined = undefined;
    let endDateString: string | undefined = undefined;
    if (paneStateData.durationSelection && paneStateData.durationSelection !== -1) {
      const duration = paneStateData.durationSelection;
      const halfDuration = duration / 2;

      const startSeconds = appSeconds - halfDuration;
      const endSeconds = appSeconds + halfDuration;

      startDateString = dateFromAppSeconds(startSeconds, playheadDate).toISOString();
      endDateString = dateFromAppSeconds(endSeconds, playheadDate).toISOString();
    }

    const chartLayout = getPlotlyChartLayout(graphHeight);

    if (startDateString && endDateString) {
      chartLayout.xaxis.autorange = false;
      chartLayout.xaxis.range = [startDateString, endDateString];
    } else {
      chartLayout.xaxis.autorange = true;
      chartLayout.xaxis.range = undefined;
    }

    const plotIndexToHighlight = findPlotIndexToHighlight(hoverSeconds || appSeconds);

    const updatedChartProps = {
      ...chartProps,
      plotIndexToHighlight,
      chartData: {
        ...chartProps.chartData,
        plotlyChartLayout: chartLayout,
      },
    };

    setChartProps(updatedChartProps);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chartProps, findPlotIndexToHighlight, graphHeight, hoverSeconds would cause infinite loops
  }, [graphData, paneStateData.durationSelection, playheadDate, appSeconds]);

  // handle hover over graph
  useEffect(() => {
    if (!graphData) return;

    const plotIndexToHighlight = findPlotIndexToHighlight(hoverSeconds || appSeconds);

    const updatedChartProps = {
      ...chartProps,
      plotIndexToHighlight,
    };

    setChartProps(updatedChartProps);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chartProps, findPlotIndexToHighlight would cause infinite loops
  }, [graphData, appSeconds, hoverSeconds]);

  if (graphDataIsBad === "unauthorized") {
    return <div>Unauthorized</div>;
  } else if (graphDataIsBad === "invalid-data") {
    return <div>Invalid graph data</div>;
  }

  return (
    <div className={styles.main}>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      {selectedGraph && <div>{selectedGraph?.title}</div>}
      <div style={{ width: "100%" }}>
        {selectedGraph && <DynPlotlyChart {...chartProps}></DynPlotlyChart>}
      </div>

      <HelpOverlay
        isModalOpen={paneStateData.showHelp}
        closeHandler={() => {
          dispatch(
            setPaneStateDataValue({
              paneInstanceId,
              paneStateProperty: "showHelp",
              paneStateValue: !paneStateData.showHelp,
            })
          );
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
