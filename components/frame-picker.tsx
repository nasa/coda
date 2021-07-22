import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faCamera,
  faGlobeAmericas,
  faChartLine,
  faShareSquare,
  faLayerGroup,
  faSquare,
  faVideo,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import _ from "lodash";
import { allFrames } from "store/viewer";
import styles from "./frame-picker.module.css";

library.add(faCamera, faChartLine, faGlobeAmericas, faLayerGroup, faShareSquare, faSquare, faVideo);

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
    icon: "chart-line",
    color: "mustard-green",
  },
  5: {
    icon: "layer-group",
    color: "mustgard-green",
  },
  6: {
    icon: "chart-line",
    color: "mustard-green",
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
  return (
    <div className={styles.main}>
      {Object.keys(allFrames).map((id) => (
        <FrameSelection id={+id} />
      ))}
    </div>
  );
}
