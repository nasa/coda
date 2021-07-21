import _ from "lodash";
import { useSelector } from "react-redux";
import { allLayouts } from "store/viewer";
import styles from "./viewer.module.css";

export function Frame({ width, height }: { width: number; height: number }) {
  return <div style={{ width, height }}></div>;
}

export default function Viewer() {
  const selectedLayout = useSelector((state) => state.viewer.layout);
  const layoutDefinition = allLayouts[selectedLayout];

  return (
    <div className={`${styles.main} ${styles.layout1}`}>
      <div className={`${styles.frame} ${styles.f1}`}>1</div>
      <div className={`${styles.frame} ${styles.f2}`}>2</div>
      <div className={`${styles.frame} ${styles.f3}`}>3</div>
      <div className={`${styles.frame} ${styles.f4}`}>4</div>
      <div className={`${styles.frame} ${styles.f5}`}>5</div>
      <div className={`${styles.frame} ${styles.f6}`}>6</div>
    </div>
  );
}
