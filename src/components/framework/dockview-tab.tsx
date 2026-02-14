/**
 * Custom Dockview tab component.
 *
 * Shows the pane icon and short title for each tab. Dockview handles the
 * drag-and-drop and activation behavior automatically.
 */

import { FunctionComponent } from "react";
import type { IDockviewPanelHeaderProps } from "dockview-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import { allPanes } from "store/framework";

interface PanelParams {
  frameId: number;
}

export const DockviewPaneTab: FunctionComponent<IDockviewPanelHeaderProps<PanelParams>> = ({
  params,
}) => {
  const frameId = params.frameId;
  const frameState = useAppSelector((state) => state.framework.frames[frameId], shallowEqual);

  const paneType = frameState?.paneType ?? "empty";
  const paneInfo = allPanes[paneType];

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent default only for middle-click to avoid closing
    if (e.button === 1) {
      e.preventDefault();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "0 8px",
        height: "100%",
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontSize: 12,
      }}
      onMouseDown={handleMouseDown}
    >
      {paneInfo?.icon && <FontAwesomeIcon icon={paneInfo.icon} style={{ fontSize: 11 }} />}
      <span>{paneInfo?.shortTitle ?? "None"}</span>
    </div>
  );
};
