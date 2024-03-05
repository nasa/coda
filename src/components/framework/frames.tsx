import _ from "lodash";
import { useSelector } from "react-redux";
import Frame from "components/framework/frame";
import { allLayouts } from "store/framework";
import styles from "./frames.module.css";

import { RootState } from "store/index";

export default function Viewer() {
  const selectedLayout = useSelector((state: RootState) => state.framework.layout);
  const layoutDefinition = allLayouts[selectedLayout];

  const frames = [];
  for (let i = 1; i <= layoutDefinition.frameCount; i++) {
    // CSS Grid definitions
    const gridAreaName = styles[`f${i}`];
    frames.push(
      <div className={`${styles.frameContainer} ${gridAreaName}`} key={`FRAME__${i}`}>
        <Frame id={i} />
      </div>
    );
  }

  const mainStyleName = layoutDefinition.cssGridRows === 9 ? styles.main_9Rows : styles.main_10Rows;

  return (
    <div>
      <div className={`${mainStyleName} ${styles[`layout_${selectedLayout}`]}`}>{frames}</div>
    </div>
  );
}
