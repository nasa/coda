import _ from "lodash";
import styles from "./frame.module.css";
import { useSelector } from "react-redux";
import { RootState } from "store";

import { ModalDropdown } from "components/interface/dropdown-modal";
import PanePickerModal, { PaneLabel } from "./pane-picker";

import EventInfo, { EventInfoControls } from "components/panes/event-info";
import VideoPane, { VideoDLPaneControls, VideoOtherPaneControls } from "components/panes/video";
import PhotoPane, { PhotoControls } from "components/panes/photo";
import PhotoAllPane, { PhotoAllControls } from "components/panes/photo-all";
import { ISSLocation, ISSLocationControls } from "components/panes/iss-location";
import { useLayoutEffect, useRef, useState } from "react";
import GPSLocation, { GPSLocationControls } from "components/panes/gps-location";
import CommPane, { CommControls } from "components/panes/comm";
import LineGraph, { LineGraphControls } from "components/panes/line-graph";

export interface Options {
  frameID: number;
  frameTypeID: number;
}

/** Renders the header for a frame */
export function FrameHeader(props: { frameID: number; paneType: string; children?: any }) {
  let label = <>&nbsp;Select display type</>;

  if (!_.isNil(props.paneType)) {
    label = <PaneLabel paneType={props.paneType} />;
  }

  return (
    <div className={styles.header}>
      <div>
        <div className={styles.dropdown}>
          <ModalDropdown
            color="grey"
            size="skinny"
            modal={PanePickerModal}
            modalOptions={{ frameID: props.frameID }}
          >
            {label}
          </ModalDropdown>
        </div>
      </div>
      <div className={styles.controls}>{props.children}</div>
    </div>
  );
}

const frameTypeIDsToPanes: PaneTypeComponentSets = {
  empty: {
    controls: () => null,
    pane: () => null,
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
    controls: LineGraphControls,
    pane: LineGraph,
  },
};

/** Identify the frame */
export interface Options {
  id: number;
}

const headerContainerHeight = 35;

/** Renders a frame in the viewer */
export default function Frame(options) {
  const frameState = useSelector((state: RootState) => state.framework.frames[options.id]);

  let paneType = null;
  if (frameState) {
    paneType = frameState.paneType;
  }

  let FrameRender = null;
  let FrameControls = null;
  if (!_.isNil(paneType)) {
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
    Also, set an interval to periodically update the frame size. The onResize event method doesn't seem to capture all new frames. The browser must not always fire resize events when the CSS grid creates new frame layouts */
  useLayoutEffect(() => {
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
        <FrameHeader frameID={options.id} paneType={paneType}>
          {!_.isNil(FrameControls) ? (
            <FrameControls frameID={options.id} frameDimensions={frameDimensions} />
          ) : (
            <></>
          )}
        </FrameHeader>
      </div>
      <div className={styles.bodyContainer}>
        {!_.isNil(FrameRender) ? (
          <FrameRender frameID={options.id} frameDimensions={frameDimensions} />
        ) : (
          <>
            <div className={styles.photoPoster}></div>
          </>
        )}
      </div>
    </div>
  );
}
