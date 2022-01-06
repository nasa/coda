import _ from "lodash";
import React from "react";
import { useDispatch } from "react-redux";
import { changeLayout, allLayouts } from "store/framework";
import styles from "./layout-picker.module.css";

export default function LayoutPicker({ closeClick }: { closeClick?: () => void }) {
  const dispatch = useDispatch();

  /**
   * Change the layout
   * @param index The index of the layout in allLayouts
   */
  const handleSelectLayout = (e: React.MouseEvent, index: number) => {
    e.preventDefault();

    dispatch(changeLayout(index));
    closeClick();
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
            onClick={(e) => handleSelectLayout(e, +index)}
            key={`LAYOUT_${index}`}
          >
            <img src={layout.svg} alt={`Select layout ${index}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
