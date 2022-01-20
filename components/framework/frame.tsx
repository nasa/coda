import _ from "lodash";
import styles from "./frame.module.css";
import { useSelector } from "react-redux";
import { RootState } from "store";

import { ModalDropdown } from "components/interface/dropdown-v2";
import PanePickerModal, { PaneLabel } from "./pane-picker";

import EVAInfo, { EVAInfoControls } from "components/panes/eva-info";
import VideoPane, { VideoDLPaneControls, VideoOtherPaneControls } from "components/panes/video";
import PhotoPane, { PhotoControls } from "components/panes/photos";
import { ISSLocation, ISSLocationControls } from "components/panes/iss-location";
import { useEffect, useRef, useState } from "react";

export interface Options {
  frameID: number;
  frameTypeID: number;
}

/** Renders the header for a frame */
export function FrameHeader(props: { frameID: number; paneType: string; children?: any }) {
  let label = <>&nbsp;Pick a source</>;

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
  iss_downlink: VideoPane,
  iss_non_downlink: VideoPane,
  iss_photo: PhotoPane,
  iss_position: ISSLocation,
  iss_eva_info: EVAInfo,
};

const frameTypeIDsToControls = {
  iss_downlink: VideoDLPaneControls,
  iss_non_downlink: VideoOtherPaneControls,
  iss_photo: PhotoControls,
  iss_position: ISSLocationControls,
  iss_eva_info: EVAInfoControls,
};

/** Identify the frame */
export interface Options {
  id: number;
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
  const [frameWidth, setFrameWidth] = useState(false);
  const frameRef = useRef(null);
  useEffect(() => {
    setFrameWidth(frameRef.current ? frameRef.current.offsetWidth : 0);
  }, [frameRef]);

  /** Handle resize events and rerender components */
  useEffect(() => {
    function handleResize() {
      setFrameWidth(frameRef.current ? frameRef.current.offsetWidth : 0);
    }
    window.addEventListener("resize", handleResize);
  });

  return (
    <div className={styles.main} ref={frameRef}>
      <div className={styles.headerContainer}>
        <FrameHeader frameID={options.id} paneType={paneType}>
          {!_.isNil(FrameControls) ? (
            <FrameControls frameID={options.id} frameWidth={frameWidth} />
          ) : (
            <></>
          )}
        </FrameHeader>
      </div>
      <div className={styles.bodyContainer}>
        {!_.isNil(FrameRender) ? (
          <FrameRender frameID={options.id} />
        ) : (
          <>
            <div className={styles.photoPoster}></div>
          </>
        )}
      </div>
    </div>
  );
}
