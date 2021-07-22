import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faCamera,
  faGlobeAmericas,
  faChartLine,
  faShareSquare,
  faInfo,
  faLayerGroup,
  faSquare,
  faVideo,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import _ from "lodash";
import { useSelector } from "react-redux";
import { allFrames } from "store/viewer";
import styles from "./frame-picker.module.css";

library.add(
  faCamera,
  faChartLine,
  faGlobeAmericas,
  faInfo,
  faLayerGroup,
  faShareSquare,
  faSquare,
  faVideo
);

const frameDecoration = {
  0: {
    icon: "video",
    color: "teal",
  },
  1: {
    icon: "video",
    color: "teal",
  },
  2: {
    icon: "camera",
    color: "ruby",
  },
  3: {
    icon: "globe-americas",
    color: "purple",
  },
  4: {
    icon: "info",
    color: "mustardGreen",
  },
  5: {
    icon: "layer-group",
    color: "mustardGreen",
  },
  6: {
    icon: "chart-line",
    color: "mustardGreen",
  },
};

export function FrameSelection({ id }: { id: number }) {
  const { title } = allFrames[id];
  const { icon, color } = frameDecoration[id];

  return (
    <div className={styles.item}>
      <div className={`${styles.icon} ${styles[color]}`}>
        <FontAwesomeIcon icon={icon} />
      </div>
      <div className={styles.verticalCenter}>{title}</div>
    </div>
  );
}

export default function FramePicker() {
  const selectedSource = useSelector((state) => state.viewer.selectedSource);

  const availableFrames = Object.keys(allFrames).filter(
    (id) => allFrames[id].source === selectedSource
  );

  return (
    <div className={styles.main}>
      {availableFrames.length > 0 ? (
        availableFrames.map((id) => <FrameSelection id={+id} />)
      ) : (
        <span>No available sources</span>
      )}
    </div>
  );
}
