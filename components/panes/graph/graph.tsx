import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setPaneStateValue } from "store/framework";
import { RootState } from "store/index";
import { parseGandalfHeartrateDataFile } from "utils/graphs";

import styles from "./graph.module.css";

export function GraphControls(props: { frameID: number }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const paneStateData: GraphPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}>
        <div>Selected Graph id: {paneStateData.selectedGraphId}</div>
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

export default function Graph(props: { frameID: number }) {
  const paneStateData: GraphPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  const graphs: GraphsState = useSelector((state: RootState) => state.graphs);

  const [graphData, setGraphData] = useState(null);

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
      setGraphData(data);
    };

    localAsyncFetchData();
  }, [graphs.graphsManifest]);

  useEffect(() => {
    if (!graphData) {
      return;
    }

    const heartRateData = parseGandalfHeartrateDataFile(graphData);
    console.log(heartRateData);
  }, [graphData]);

  return (
    <div className={styles.main}>
      <div>Hello</div>
      <div>Graph data: {JSON.stringify(graphData)}</div>

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
