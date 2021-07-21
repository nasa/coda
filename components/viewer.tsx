import _ from "lodash";
import { useSelector } from "react-redux";
import { allLayouts } from "store/viewer";
import styles from "./viewer.module.css";

export function Frame() {
  return <div className={styles.frame}></div>;
}

export default function Viewer() {
  const selectedLayout = useSelector((state) => state.viewer.layout);
  const layoutDefinition = allLayouts[selectedLayout];

  const frames = [];
  for (let i = 1; i <= layoutDefinition.frames; i++) {
    const gridAreaName = styles[`f${i}`];
    frames.push(
      <div className={`${styles.frameContainer} ${gridAreaName}`}>
        <Frame />
      </div>
    );
  }

  return <div className={`${styles.main} ${styles[`layout${selectedLayout}`]}`}>{frames}</div>;
}
