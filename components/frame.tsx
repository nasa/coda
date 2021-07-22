import _ from "lodash";
import { useSelector } from "react-redux";
import { PseudoDropdown } from "components/dropdown-v2";
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

/** Identify the frame */
export interface Options {
  id: number;
}

/** Renders a frame in the viewer */
export default function Frame(options: React.PropsWithChildren<Options>) {
  const frameTypeID = useSelector((state) => state.viewer.frames[options.id]);

  return (
    <div className={styles.main}>
      <FrameHeader frameID={options.id} frameTypeID={frameTypeID} />
      {options.id}
    </div>
  );
}
