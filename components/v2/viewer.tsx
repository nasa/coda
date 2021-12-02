import _ from "lodash";
import { useSelector } from "react-redux";
import Frame from "components/v2/frame";
import { allLayouts } from "store/viewer";
import styles from "./viewer.module.css";
import { RootState } from "../../store";

export default function Viewer() {
  const selectedLayout = useSelector((state: RootState) => state.viewer.layout);
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

  return (
    <div>
      <div className={`${styles.main} ${styles[`layout${selectedLayout}`]}`}>{frames}</div>;
    </div>
  );
}
