import _ from "lodash";
import React from "react";
import { useDispatch } from "react-redux";
import { changeLayout, allLayouts } from "store/framework";
import styles from "./layout-picker.module.css";
import layoutStyles from "/components/framework/frames.module.css";

export default function LayoutPicker({ closeClick }: { closeClick?: () => void }) {
  const dispatch = useDispatch();

  /**
   * Change the layout
   * @param index The index of the layout in allLayouts
   */
  const handleSelectLayout = (e: React.MouseEvent, index: string) => {
    e.preventDefault();

    dispatch(changeLayout(index));
    closeClick();
  };

  const drawLayoutLargeIcon = (layout: string) => {
    const layoutGrid = layoutStyles[`layout_${layout}`];

    const layoutDefinition = allLayouts[layout];
    const mainStyleName =
      layoutDefinition.cssGridRows === 9
        ? layoutStyles.largeIcon_9Rows
        : layoutStyles.largeIcon_10Rows;
    const frames = [];
    for (let i = 1; i <= layoutDefinition.frameCount; i++) {
      // CSS Grid definitions
      const gridAreaName = layoutStyles[`f${i}`];
      frames.push(
        <div
          className={`${layoutStyles.largeIconFrameContainer} ${gridAreaName}`}
          key={`FRAME__${i}`}
        >
          <div className={layoutStyles.largeIconFrameBackground}></div>
        </div>
      );
    }
    return (
      <div className={layoutStyles.layoutlargeIconContainer}>
        <div className={`${mainStyleName} ${layoutGrid}`}>{frames}</div>
      </div>
    );
  };

  return (
    <div className={styles.main}>
      <div className={styles.top}>
        <div>Select a Layout</div>
        {closeClick && (
          <div className={styles.close} onClick={closeClick}>
            ✕
          </div>
        )}
      </div>
      <div className={styles.layouts}>
        {_.map(allLayouts, (layout, index) => (
          <div
            className={styles.layout}
            onClick={(e) => handleSelectLayout(e, index)}
            key={`LAYOUT_${index}`}
          >
            {drawLayoutLargeIcon(index)}
          </div>
        ))}
      </div>
    </div>
  );
}
