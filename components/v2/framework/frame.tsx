import _ from "lodash";
import styles from "./frame.module.css";
import { useSelector } from "react-redux";
import { RootState } from "store";

import { ModalDropdown } from "components/v2/interface/dropdown-v2";
import PanePickerModal, { PaneLabel } from "./pane-picker";

import EVAInfo, { EVAInfoControls } from "components/v2/panes/eva-info";
import VideoFrame, { VideoControls } from "components/v2/panes/video-v2";
import { ISSLocation, ISSLocationControls } from "components/v2/panes/iss-location";
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
  iss_downlink: VideoFrame,
  iss_non_downlink: () => <>1: ISS Video Non-Downlink</>,
  iss_photo: () => <>2: ISS Photography</>,
  iss_groundtrack: ISSLocation,
  iss_eva_info: EVAInfo,
  iss_doug: () => <>5: ISS Doug</>,
  iss_telemetry: () => <>6: ISS Telemetry</>,
};

const frameTypeIDsToControls = {
  iss_downlink: VideoControls,
  iss_non_downlink: () => <>Controls: ISS Video Non-Downlink</>,
  iss_photo: () => <>Controls: ISS Photography</>,
  iss_groundtrack: ISSLocationControls,
  iss_eva_info: EVAInfoControls,
  iss_doug: () => <>Controls: ISS Doug!</>,
  iss_telemetry: () => <>Controls: ISS Telemetry</>,
};

/** Identify the frame */
export interface Options {
  id: number;
}

/** Renders a frame in the viewer */
export default function Frame(options) {
  const frameState = useSelector((state: RootState) => state.viewer.frames[options.id]);

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

  return (
    <div className={styles.main} ref={frameRef}>
      <div className={styles.headerContainer}>
        <FrameHeader frameID={options.id} paneType={paneType}>
          {!_.isNil(FrameControls) ? (
            <FrameControls frameID={options.id} frameWidth={frameWidth} />
          ) : (
            <>Controls {options.id}</>
          )}
        </FrameHeader>
      </div>
      <div className={styles.bodyContainer}>
        {!_.isNil(FrameRender) ? <FrameRender frameID={options.id} /> : <>Frame {options.id}</>}
      </div>
    </div>
  );
}
