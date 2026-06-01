/**
 * Dockview panel content component.
 *
 * Each Dockview panel renders one pane. The pane type and state are read from
 * Redux via the `paneInstanceId` passed in panel params.
 *
 * When the pane type is "empty" (or unset), a watermark pane picker is shown
 * so the user can choose what to display in this panel.
 *
 * Pane controls are rendered in the header (right actions) — not here.
 */

import { FunctionComponent, useEffect, useMemo, useState } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { shallowEqual, useAppSelector, refEqual } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { allPanes, setPaneType } from "store/framework";
import { getAvailablePanesForSource } from "utils/sourceDataTypeMap";
import { PaneLabel } from "../pane-picker";

import EventInfo from "components/panes/event-info";
import VideoPaneChooser from "components/panes/video/video-chooser";
import PhotoPane from "components/panes/photo";
import PhotoAllPane from "components/panes/photo-all";
import { ISSLocation } from "components/panes/iss-location";
import GPSLocation from "components/panes/gps-location";
import CommPane from "components/panes/comm";
import Graph from "components/panes/graph/graph";
import PcdAudioPane from "components/panes/pcd-audio";

import styles from "./dockview-pane-panel.module.css";

const paneComponents: Record<string, React.ComponentType<PaneComponentProps> | null> = {
  empty: null,
  video_downlink: VideoPaneChooser,
  video_non_downlink: VideoPaneChooser,
  photo: PhotoPane,
  photo_all: PhotoAllPane,
  iss_location: ISSLocation,
  gps_location: GPSLocation,
  event_info: EventInfo,
  comm: CommPane,
  graph: Graph,
  pcd_audio: PcdAudioPane,
};

interface PanelParams {
  paneInstanceId: number;
}

export const DockviewPanePanel: FunctionComponent<IDockviewPanelProps<PanelParams>> = ({
  api,
  params,
}) => {
  const paneInstanceId = params.paneInstanceId;
  const frameState = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId],
    shallowEqual
  );
  const source = useAppSelector((state) => state.framework.source, refEqual);
  const date = useAppSelector((state) => state.clock.date, refEqual);
  const dispatch = useAppDispatch();

  const paneType = frameState?.paneType ?? "";

  const [dimensions, setDimensions] = useState<number[]>([api.width, api.height]);

  useEffect(() => {
    const disposable = api.onDidDimensionsChange(({ width, height }) => {
      setDimensions([width, height]);
    });
    return () => disposable.dispose();
  }, [api]);

  const pcdAudioDateGate = useAppSelector((state) => state.pcdAudio.dateGate, refEqual);
  const paneDateRanges = useMemo(() => ({ pcd_audio: pcdAudioDateGate }), [pcdAudioDateGate]);

  const allPaneTypes = useMemo(() => Object.keys(allPanes) as PaneType[], []);
  const availablePanes = useMemo(
    () =>
      getAvailablePanesForSource(source, allPaneTypes, date, paneDateRanges).filter(
        (pt) => pt !== "empty"
      ),
    [source, allPaneTypes, date, paneDateRanges]
  );

  const isCurrentPaneAvailable =
    paneType === "empty" || availablePanes.some((pt) => pt === paneType);
  const PaneComponent =
    paneType && isCurrentPaneAvailable ? (paneComponents[paneType] ?? null) : null;

  const handleSelectPaneType = (selectedType: PaneType) => {
    dispatch(setPaneType({ paneInstanceId: paneInstanceId, paneType: selectedType }));
  };

  if (!PaneComponent) {
    return (
      <div className={styles.watermark}>
        <div className={styles.watermarkGrid}>
          {availablePanes.map((pt) => (
            <div
              key={pt}
              className={styles.watermarkOption}
              onClick={() => handleSelectPaneType(pt)}
            >
              <PaneLabel paneType={pt} labelSize="L" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <PaneComponent paneInstanceId={paneInstanceId} groupDimensions={dimensions} />
    </div>
  );
};
