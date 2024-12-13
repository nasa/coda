import { FunctionComponent } from "react";
import _ from "lodash";
import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import Frame from "components/framework/frame";
import { allLayouts } from "store/framework";
import styles from "./frames.module.css";

import { RootState } from "store/index";

const Viewer: FunctionComponent = () => {
  const selectedLayout = useAppSelector((state: RootState) => state.framework.layout, shallowEqual);
  const layoutDefinition = allLayouts[selectedLayout];

  const frames: JSX.Element[] = [];
  for (let i = 1; i <= layoutDefinition.frameCount; i++) {
    // CSS Grid definitions
    const gridAreaName = styles[`f${i}`];
    frames.push(
      <div className={`${styles.frameContainer} ${gridAreaName}`} key={`FRAME__${i}`}>
        <Frame frameId={i} />
      </div>
    );
  }

  const mainStyleName = layoutDefinition.cssGridRows === 9 ? styles.main_9Rows : styles.main_10Rows;

  return (
    <div>
      <div className={`${mainStyleName} ${styles[`layout_${selectedLayout}`]}`}>{frames}</div>
    </div>
  );
};

export default Viewer;
