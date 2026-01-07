import { FunctionComponent, JSX } from "react";
import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import Frame from "components/framework/frame";
import { allLayouts } from "store/framework";
import styles from "./frames.module.css";

// Mapping objects for static class resolution - exported for use by other components
export const frameGridClasses = {
  f1: styles.f1,
  f2: styles.f2,
  f3: styles.f3,
  f4: styles.f4,
  f5: styles.f5,
  f6: styles.f6,
  f7: styles.f7,
  f8: styles.f8,
  f9: styles.f9,
} as const;

export const layoutClasses = {
  layout_a: styles.layout_a,
  layout_b: styles.layout_b,
  layout_c: styles.layout_c,
  layout_d: styles.layout_d,
  layout_e: styles.layout_e,
  layout_f: styles.layout_f,
  layout_g: styles.layout_g,
  layout_h: styles.layout_h,
  layout_i: styles.layout_i,
  layout_j: styles.layout_j,
  layout_k: styles.layout_k,
  layout_l: styles.layout_l,
  layout_m: styles.layout_m,
  layout_n: styles.layout_n,
  layout_o: styles.layout_o,
  layout_p: styles.layout_p,
  layout_q: styles.layout_q,
  layout_r: styles.layout_r,
  layout_s: styles.layout_s,
} as const;

export const iconRowClasses = {
  icon_9Rows: styles.icon_9Rows,
  icon_10Rows: styles.icon_10Rows,
} as const;

export const largeIconRowClasses = {
  largeIcon_9Rows: styles.largeIcon_9Rows,
  largeIcon_10Rows: styles.largeIcon_10Rows,
} as const;

export const containerClasses = {
  frameContainer: styles.frameContainer,
  iconFrameContainer: styles.iconFrameContainer,
  largeIconFrameContainer: styles.largeIconFrameContainer,
  layoutIconContainer: styles.layoutIconContainer,
  layoutLargeIconContainer: styles.layoutLargeIconContainer,
  iconFrameBackground: styles.iconFrameBackground,
  largeIconFrameBackground: styles.largeIconFrameBackground,
} as const;

export type FrameNumber = keyof typeof frameGridClasses;
export type LayoutKey = keyof typeof layoutClasses;

const Viewer: FunctionComponent = () => {
  const selectedLayout = useAppSelector((state) => state.framework.layout, shallowEqual);
  const layoutDefinition = allLayouts[selectedLayout];

  const frames: JSX.Element[] = [];
  for (let i = 1; i <= layoutDefinition.frameCount; i++) {
    // CSS Grid definitions
    const frameKey = `f${i}` as FrameNumber;
    const gridAreaName = frameGridClasses[frameKey];
    frames.push(
      <div className={`${styles.frameContainer} ${gridAreaName}`} key={`FRAME__${i}`}>
        <Frame frameId={i} />
      </div>
    );
  }

  const mainStyleName = layoutDefinition.cssGridRows === 9 ? styles.main_9Rows : styles.main_10Rows;
  const layoutKey = `layout_${selectedLayout}` as LayoutKey;
  const layoutClass = layoutClasses[layoutKey];

  return (
    <div>
      <div className={`${mainStyleName} ${layoutClass}`}>{frames}</div>
    </div>
  );
};

export default Viewer;
