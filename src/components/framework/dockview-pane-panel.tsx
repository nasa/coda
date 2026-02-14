/**
 * Dockview panel content component.
 *
 * Each Dockview panel renders one pane. The pane type and state are read from
 * Redux via the `frameId` passed in panel params.
 */

import { FunctionComponent, useEffect, useState } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { shallowEqual, useAppSelector } from "utils/useAppSelector";

import EventInfo from "components/panes/event-info";
import VideoPaneChooser from "components/panes/video/video-chooser";
import PhotoPane from "components/panes/photo";
import PhotoAllPane from "components/panes/photo-all";
import { ISSLocation } from "components/panes/iss-location";
import GPSLocation from "components/panes/gps-location";
import CommPane from "components/panes/comm";
import Graph from "components/panes/graph/graph";

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
};

interface PanelParams {
  frameId: number;
}

export const DockviewPanePanel: FunctionComponent<IDockviewPanelProps<PanelParams>> = ({
  api,
  params,
}) => {
  const frameId = params.frameId;
  const frameState = useAppSelector((state) => state.framework.frames[frameId], shallowEqual);

  const paneType = frameState?.paneType ?? "";
  const PaneComponent = paneType ? (paneComponents[paneType] ?? null) : null;

  const [dimensions, setDimensions] = useState<number[]>([api.width, api.height]);

  useEffect(() => {
    const disposable = api.onDidDimensionsChange(({ width, height }) => {
      setDimensions([width, height]);
    });
    return () => disposable.dispose();
  }, [api]);

  if (!PaneComponent) {
    return (
      <div className={styles.bodyContainer}>
        <div className={styles.photoPoster}></div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <PaneComponent frameID={frameId} frameDimensions={dimensions} />
    </div>
  );
};
