import _ from "lodash";
import styles from "./frame.module.css";
import { useSelector } from "react-redux";
import { RootState } from "store";

import { ModalDropdown } from "components/interface/dropdown-modal";
import PanePickerModal, { PaneLabel } from "./pane-picker";

import EventInfo, { EventInfoControls } from "components/panes/event-info";
import VideoPane, { VideoDLPaneControls, VideoOtherPaneControls } from "components/panes/video";
import PhotoPane, { PhotoControls } from "components/panes/photos";
import { ISSLocation, ISSLocationControls } from "components/panes/iss-location";
import { useEffect, useRef, useState } from "react";
import GPSLocation, { GPSLocationControls } from "components/panes/gps-location";

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

const frameTypeIDsToRenders = {
  video_downlink: VideoPane,
  video_non_downlink: VideoPane,
  photo: PhotoPane,
  iss_position: ISSLocation,
  gps_position: GPSLocation,
  event_info: EventInfo,
};

const frameTypeIDsToControls = {
  video_downlink: VideoDLPaneControls,
  video_non_downlink: VideoOtherPaneControls,
  photo: PhotoControls,
  iss_position: ISSLocationControls,
  gps_position: GPSLocationControls,
  event_info: EventInfoControls,
};

/** Identify the frame */
export interface Options {
  id: number;
}

const headerContainerHeight = 35;

function debounce(fn, ms) {
  let timer;
  return (_) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this);
    }, ms);
  };
}

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
    FrameRender = frameTypeIDsToRenders[paneType];
    FrameControls = frameTypeIDsToControls[paneType];
  }

  /** get component width and pass it to the frame controls */
  const [frameDimensions, setFrameDimensions] = useState([]);
  const frameRef = useRef(null);

  useEffect(() => {
    setFrameDimensions(
      frameRef.current
        ? [frameRef.current.offsetWidth, frameRef.current.offsetHeight - headerContainerHeight]
        : []
    );
  }, [frameRef]);

  /** Handle resize events and rerender components */
  useEffect(() => {
    const debouncedHandleResize = debounce(function handleResize() {
      setFrameDimensions(
        frameRef.current
          ? [frameRef.current.offsetWidth, frameRef.current.offsetHeight - headerContainerHeight]
          : []
      );
    }, 500);
    window.addEventListener("resize", debouncedHandleResize);

    return () => {
      window.removeEventListener("resize", debouncedHandleResize);
    };
  });

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
