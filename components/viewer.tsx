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

  const frames = [];
  for (let i = 0; i <= layoutDefinition.frames; i++) {
    frames.push(<div className={`${styles.frame} ${styles[`f${i}`]}`}>{i}</div>);
  }

  return <div className={`${styles.main} ${styles.layout1}`}>{frames}</div>;
}
