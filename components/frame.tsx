import _ from "lodash";
import { useSelector } from "react-redux";
import { ModalDropdown } from "components/dropdown-v2";
import EVAInfo, { EVAInfoControls } from "components/eva-info";
import FramePickerModal, { FrameLabel } from "components/frame-picker";
import VideoFrame, { VideoControls } from "components/video-v2";
import styles from "./frame.module.css";
import { RootState } from "../store/";

export interface Options {
  frameID: number;
  frameTypeID: number;
}

/** Renders the header for a frame */
export function FrameHeader(options) {
  let label = <>&nbsp;Pick a source</>;

  if (!_.isNil(options.frameTypeID)) {
    label = <FrameLabel frameTypeID={options.frameTypeID} />;
  }

  return (
    <div className={styles.header}>
      <div>
        <div className={styles.dropdown}>
          <ModalDropdown
            color="grey"
            size="skinny"
            modal={FramePickerModal}
            modalOptions={{ frameID: options.frameID }}
          >
            {label}
          </ModalDropdown>
        </div>
      </div>
      <div className={styles.controls}>{options.children}</div>
    </div>
  );
}

const frameTypeIDsToRenders = {
  0: VideoFrame,
  1: () => <>1: ISS Video Non-Downlink</>,
  2: () => <>2: ISS Photography</>,
  3: () => <>3: ISS Groundtrack</>,
  4: EVAInfo,
  5: () => <>5: Doug</>,
  6: () => <>6: ISS Telemetry</>,
};

const frameTypeIDsToControls = {
  0: VideoControls,
  1: () => <>Controls: ISS Video Non-Downlink</>,
  2: () => <>Controls: ISS Photography</>,
  3: () => <>Controls: ISS Groundtrack</>,
  4: EVAInfoControls,
  5: () => <>COMING SOON!</>,
  6: () => <>Controls: ISS Telemetry</>,
};

/** Identify the frame */
export interface Options {
  id: number;
}

/** Renders a frame in the viewer */
export default function Frame(options) {
  const frameTypeID = useSelector((state: RootState) => state.viewer.frames[options.id]);

  let FrameRender = null;
  let FrameControls = null;
  if (!_.isNil(frameTypeID)) {
    FrameRender = frameTypeIDsToRenders[frameTypeID];
    FrameControls = frameTypeIDsToControls[frameTypeID];
  }

  return (
    <div className={styles.main}>
      <FrameHeader frameID={options.id} frameTypeID={frameTypeID}>
        {!_.isNil(FrameControls) ? (
          <FrameControls frameID={options.id} />
        ) : (
          <>Controls {options.id}</>
        )}
      </FrameHeader>
      {!_.isNil(FrameRender) ? <FrameRender frameID={options.id} /> : <>Frame {options.id}</>}
    </div>
  );
}
