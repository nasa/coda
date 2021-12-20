import _ from "lodash";
import { useSelector } from "react-redux";
import { ModalDropdown } from "components/v2/dropdown-v2";
import EVAInfo, { EVAInfoControls } from "components/v2/eva-info";
import FramePickerModal, { FrameLabel } from "components/v2/frame-picker";
import VideoFrame, { VideoControls } from "components/v2/video-v2";
import styles from "./frame.module.css";
import { RootState } from "store";

export interface Options {
  frameID: number;
  frameTypeID: number;
}

/** Renders the header for a frame */
export function FrameHeader(options) {
  let label = <>&nbsp;Pick a source</>;

  if (!_.isNil(options.frameType)) {
    label = <FrameLabel frameType={options.frameType} />;
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
  iss_downlink: VideoFrame,
  iss_non_downlink: () => <>1: ISS Video Non-Downlink</>,
  iss_photo: () => <>2: ISS Photography</>,
  iss_groundtrack: () => <>3: ISS Groundtrack</>,
  iss_eva_info: EVAInfo,
  iss_doug: () => <>5: ISS Doug</>,
  iss_telemetry: () => <>6: ISS Telemetry</>,
};

const frameTypeIDsToControls = {
  iss_downlink: VideoControls,
  iss_non_downlink: () => <>Controls: ISS Video Non-Downlink</>,
  iss_photo: () => <>Controls: ISS Photography</>,
  iss_groundtrack: () => <>Controls: ISS Groundtrack</>,
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

  let frameType = null;
  if (frameState) {
    frameType = frameState.frameType;
  }

  let FrameRender = null;
  let FrameControls = null;
  if (!_.isNil(frameType)) {
    FrameRender = frameTypeIDsToRenders[frameType];
    FrameControls = frameTypeIDsToControls[frameType];
  }

  return (
    <div className={styles.main}>
      <FrameHeader frameID={options.id} frameType={frameType}>
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
