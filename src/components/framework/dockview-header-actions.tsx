/**
 * Dockview header action components.
 *
 * RightActions — pane-specific controls for the active panel + "+" button.
 * Sits on the same row as tabs. The void-container flex-grow override in
 * dockview-layout.module.css keeps controls adjacent to tabs instead of
 * flushed to the far right.
 */

import { FunctionComponent, useCallback, useEffect, useState } from "react";
import type { IDockviewHeaderActionsProps, IDockviewPanel } from "dockview-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { addFrame } from "store/framework";
import styles from "./dockview-header-actions.module.css";

import { EventInfoControls } from "components/panes/event-info";
import { VideoDLPaneControls, VideoOtherPaneControls } from "components/panes/video/video-controls";
import { PhotoControls } from "components/panes/photo";
import { PhotoAllControls } from "components/panes/photo-all";
import { ISSLocationControls } from "components/panes/iss-location";
import { GPSLocationControls } from "components/panes/gps-location";
import { CommControls } from "components/panes/comm";
import { GraphControls } from "components/panes/graph/graph";

const controlComponents: Record<string, React.ComponentType<PaneComponentProps> | null> = {
  empty: null,
  video_downlink: VideoDLPaneControls,
  video_non_downlink: VideoOtherPaneControls,
  photo: PhotoControls,
  photo_all: PhotoAllControls,
  iss_location: ISSLocationControls,
  gps_location: GPSLocationControls,
  event_info: EventInfoControls,
  comm: CommControls,
  graph: GraphControls,
};

/** Extract the frameId from the active panel's params. */
function getActiveFrameId(activePanel: IDockviewPanel | undefined): number {
  return (activePanel?.params?.frameId as number) ?? 0;
}

// ---------------------------------------------------------------------------
// Right header actions — controls + "+" button
// ---------------------------------------------------------------------------

export const DockviewRightActions: FunctionComponent<IDockviewHeaderActionsProps> = ({
  group,
  containerApi,
}) => {
  const dispatch = useAppDispatch();
  const [frameId, setFrameId] = useState(() => getActiveFrameId(group.activePanel));

  useEffect(() => {
    setFrameId(getActiveFrameId(group.activePanel));
    const disposable = group.api.onDidActivePanelChange(() => {
      setFrameId(getActiveFrameId(group.activePanel));
    });
    return () => disposable.dispose();
  }, [group]);

  const frameState = useAppSelector((state) => state.framework.frames[frameId], shallowEqual);
  const paneType = frameState?.paneType ?? "";
  const ControlComponent = paneType ? (controlComponents[paneType] ?? null) : null;
  const dimensions = [group.width ?? 0, group.height ?? 0];

  const handleAddPanel = useCallback(() => {
    let maxId = 0;
    for (const panel of containerApi.panels) {
      const fId = (panel.params?.frameId as number) ?? 0;
      if (fId > maxId) maxId = fId;
    }
    const newFrameId = maxId + 1;
    dispatch(addFrame(newFrameId));
    containerApi.addPanel({
      id: `frame-${newFrameId}`,
      component: "pane",
      tabComponent: "paneTab",
      params: { frameId: newFrameId },
      position: { referenceGroup: group },
    });
  }, [containerApi, dispatch, group]);

  return (
    <div className={styles.rightActions}>
      {ControlComponent && frameId > 0 && (
        <div className={styles.controls}>
          <ControlComponent frameID={frameId} frameDimensions={dimensions} />
        </div>
      )}
      <button className={styles.addButton} onClick={handleAddPanel} title="Add panel">
        <FontAwesomeIcon icon={faPlus} />
      </button>
    </div>
  );
};
