import isNil from "lodash/isNil";
import styles from "./frame.module.css";
import { shallowEqual, useAppSelector } from "utils/useAppSelector";

import { ModalDropdown } from "components/interface/dropdown-modal";
import PanePickerModal, { PaneLabel } from "./pane-picker";

import EventInfo, { EventInfoControls } from "components/panes/event-info";
import VideoPane, { VideoDLPaneControls, VideoOtherPaneControls } from "components/panes/video";
import PhotoPane, { PhotoControls } from "components/panes/photo";
import PhotoAllPane, { PhotoAllControls } from "components/panes/photo-all";
import { ISSLocation, ISSLocationControls } from "components/panes/iss-location";
import { useLayoutEffect, useEffect, useRef, useState, FunctionComponent } from "react";
import GPSLocation, { GPSLocationControls } from "components/panes/gps-location";
import CommPane, { CommControls } from "components/panes/comm";
import Graph, { GraphControls } from "components/panes/graph/graph";

/** Renders the header for a frame */
export const FrameHeader: FunctionComponent<{
  frameID: number;
  paneType: string;
  children?: any;
  frameDimensions?: number[];
}> = ({ frameID, paneType, children, frameDimensions = [] }) => {
  let labelSize: "S" | "M" | "L" = "S";
  let dropdownStyle = styles.dropdownSmallest;
  if (frameDimensions[0] > 470) {
    labelSize = "L";
    dropdownStyle = styles.dropdown;
  } else if (frameDimensions[0] > 260) {
    labelSize = "M";
    dropdownStyle = styles.dropdownSmall;
  }

  let label = <>&nbsp;Select display type</>;

  if (!isNil(paneType)) {
    label = <PaneLabel paneType={paneType} labelSize={labelSize} />;
  }

  return (
    <div className={styles.header}>
      <div>
        <div className={dropdownStyle}>
          <ModalDropdown
            color="grey"
            size="skinny"
            modal={PanePickerModal}
            modalOptions={{ frameID }}
          >
            {label}
          </ModalDropdown>
        </div>
      </div>
      <div className={styles.controls}>{children}</div>
    </div>
  );
};

const frameTypeIDsToPanes: PaneTypeComponentSets = {
  empty: {
    controls: null,
    pane: null,
  },
  video_downlink: {
    controls: VideoDLPaneControls,
    pane: VideoPane,
  },
  video_non_downlink: {
    controls: VideoOtherPaneControls,
    pane: VideoPane,
  },
  photo: {
    controls: PhotoControls,
    pane: PhotoPane,
  },
  photo_all: {
    controls: PhotoAllControls,
    pane: PhotoAllPane,
  },
  iss_location: {
    controls: ISSLocationControls,
    pane: ISSLocation,
  },
  gps_location: {
    controls: GPSLocationControls,
    pane: GPSLocation,
  },
  event_info: {
    controls: EventInfoControls,
    pane: EventInfo,
  },
  comm: {
    controls: CommControls,
    pane: CommPane,
  },
  graph: {
    controls: GraphControls,
    pane: Graph,
  },
};

const headerContainerHeight = 35;

/** Renders a frame in the viewer */
const Frame: FunctionComponent<{ frameId: number }> = ({ frameId }) => {
  const frameState = useAppSelector((state) => state.framework.frames[frameId], shallowEqual);

  let paneType: string = null;
  if (frameState) {
    paneType = frameState.paneType;
  }

  let FrameRender = null;
  let FrameControls = null;
  if (!isNil(paneType)) {
    FrameRender = frameTypeIDsToPanes[paneType].pane;
    FrameControls = frameTypeIDsToPanes[paneType].controls;
  }

  /** get component width and pass it to the frame controls */
  const [frameDimensions, setFrameDimensions] = useState([]);
  const frameRef = useRef(null);

  function handleResize() {
    setFrameDimensions(
      frameRef.current
        ? [frameRef.current.offsetWidth, frameRef.current.offsetHeight - headerContainerHeight]
        : []
    );
  }
  /** Using useLayoutEffect because it guarantees to fire immediately after the frame has been rendered to the DOM
    Also, set an interval to periodically update the frame size. The onResize event method doesn't seem to capture all new frames.
    The browser must not always fire resize events when the CSS grid creates new frame layouts */
  const canUseDOM = typeof window !== "undefined";
  const useIsomorphicLayoutEffect = canUseDOM ? useLayoutEffect : useEffect;
  useIsomorphicLayoutEffect(() => {
    if (frameRef.current) {
      handleResize();
      window.addEventListener("resize", handleResize);
      const interval = setTimeout(() => {
        handleResize();
      }, 3000);

      return () => {
        window.removeEventListener("resize", handleResize);
        clearInterval(interval);
      };
    }
  }, [frameRef]);

  return (
    <div className={styles.main} ref={frameRef}>
      <div className={styles.headerContainer}>
        <FrameHeader frameID={frameId} paneType={paneType} frameDimensions={frameDimensions}>
          {!isNil(FrameControls) ? (
            <FrameControls frameID={frameId} frameDimensions={frameDimensions} />
          ) : (
            <></>
          )}
        </FrameHeader>
      </div>
      <div className={styles.bodyContainer}>
        {!isNil(FrameRender) ? (
          <FrameRender frameID={frameId} frameDimensions={frameDimensions} />
        ) : (
          <>
            <div className={styles.photoPoster}></div>
          </>
        )}
      </div>
    </div>
  );
};

export default Frame;
