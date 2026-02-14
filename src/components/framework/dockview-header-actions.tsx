/**
 * Dockview header action components.
 *
 * LeftActions  — pane picker dropdown for the active panel in a group.
 * RightActions — pane-specific controls for the active panel in a group.
 *
 * Both components react to `group.onDidActivePanelChange` so they update
 * when the user switches tabs within a group.
 */

import { FunctionComponent, useEffect, useState } from "react";
import type { IDockviewHeaderActionsProps, IDockviewPanel } from "dockview-react";
import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import { ModalDropdown } from "components/interface/dropdown-modal";
import PanePickerModal, { PaneLabel } from "./pane-picker";
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
// Left header actions — pane picker dropdown
// ---------------------------------------------------------------------------

export const DockviewLeftActions: FunctionComponent<IDockviewHeaderActionsProps> = ({ group }) => {
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

  const groupWidth = group.width ?? 300;
  let labelSize: "S" | "M" | "L" = "S";
  let dropdownStyle = styles.dropdownSmallest;
  if (groupWidth > 470) {
    labelSize = "L";
    dropdownStyle = styles.dropdown;
  } else if (groupWidth > 260) {
    labelSize = "M";
    dropdownStyle = styles.dropdownSmall;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", paddingLeft: 4 }}>
      <div className={dropdownStyle}>
        <ModalDropdown
          color="grey"
          size="skinny"
          modal={PanePickerModal}
          modalOptions={{ frameID: frameId }}
        >
          {paneType ? (
            <PaneLabel paneType={paneType} labelSize={labelSize} />
          ) : (
            <>&nbsp;Select display type</>
          )}
        </ModalDropdown>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Right header actions — pane controls
// ---------------------------------------------------------------------------

export const DockviewRightActions: FunctionComponent<IDockviewHeaderActionsProps> = ({ group }) => {
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

  if (!ControlComponent || !frameId) {
    return null;
  }

  const dimensions = [group.width ?? 0, group.height ?? 0];

  return (
    <div className={styles.controls}>
      <ControlComponent frameID={frameId} frameDimensions={dimensions} />
    </div>
  );
};
