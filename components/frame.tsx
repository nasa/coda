import _ from "lodash";
import { useSelector } from "react-redux";
import { PseudoDropdown } from "components/dropdown-v2";
import EVAInfo from "components/eva-info";
import FramePickerModal, { FrameLabel } from "components/frame-picker";
import styles from "./frame.module.css";

/** Renders the header for a frame */
export function FrameHeader({ frameID, frameTypeID }: { frameID: number; frameTypeID: number }) {
  let label = <>&nbsp;Pick a source</>;

  if (!_.isNil(frameTypeID)) {
    label = <FrameLabel frameTypeID={frameTypeID} />;
  }

  return (
    <div className={styles.header}>
      <div>
        <div className={styles.dropdown}>
          <PseudoDropdown
            color="grey"
            size="skinny"
            modal={FramePickerModal}
            modalOptions={{ frameID }}
          >
            {label}
          </PseudoDropdown>
        </div>
      </div>
    </div>
  );
}

const frameTypesToElements = {
  0: () => <>0: ISS Video Downlink</>,
  1: () => <>1: ISS Video Non-Downlink</>,
  2: () => <>2: ISS Photography</>,
  3: () => <>3: ISS Groundtrack</>,
  4: EVAInfo,
  5: () => <>5: Doug</>,
  6: () => <>6: ISS Telemetry</>,
};

/** Identify the frame */
export interface Options {
  id: number;
}

/** Renders a frame in the viewer */
export default function Frame(options: React.PropsWithChildren<Options>) {
  const frameTypeID = useSelector((state) => state.viewer.frames[options.id]);

  let FrameRender = () => <>{options.id}</>;
  if (!_.isNil(frameTypeID)) {
    FrameRender = frameTypesToElements[frameTypeID];
  }

  return (
    <div className={styles.main}>
      <FrameHeader frameID={options.id} frameTypeID={frameTypeID} />
      <FrameRender />
    </div>
  );
}
