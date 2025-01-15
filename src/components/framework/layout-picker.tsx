import map from "lodash/map";
import { useState } from "react";
import { useAppSelector, deepEqual } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { RootState } from "store/index";
import { changeLayout, allLayouts } from "store/framework";
import styles from "./layout-picker.module.css";
import layoutStyles from "/components/framework/frames.module.css";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";

const LayoutPicker = ({ closeClick }: { closeClick?: () => void }) => {
  const frameworkState = useAppSelector((state: RootState) => state.framework, deepEqual);
  const [helpOpen, setHelpOpen] = useState(false);
  const dispatch = useAppDispatch();

  /**
   * Change the layout
   * @param index The index of the layout in allLayouts
   */
  const handleSelectLayout = (e: React.MouseEvent, index: string) => {
    e.preventDefault();
    // clientLogger.info({ logId: "user-select-layout", selectedLayout: index });
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
        <div>
          <div className={styles.verticalCenter}>
            <HelpButton
              clickHandler={() => {
                setHelpOpen(!helpOpen);
              }}
            />
          </div>
        </div>
        {closeClick && (
          <div className={styles.close} onClick={closeClick}>
            ✕
          </div>
        )}
      </div>
      <div className={styles.layouts}>
        {map(allLayouts, (layout, index) => (
          <div
            className={`${styles.layout} ${
              index === frameworkState.layout ? styles.layoutselected : ""
            }`}
            onClick={(e) => handleSelectLayout(e, index)}
            key={`LAYOUT_${index}`}
          >
            {drawLayoutLargeIcon(index)}
          </div>
        ))}
      </div>
      <HelpOverlay
        isModalOpen={helpOpen}
        closeHandler={() => {
          setHelpOpen(false);
        }}
      >
        <div>
          <p>
            CODA Layouts determines the number of visible application frames and how they are
            displayed.
          </p>
          <p>
            Changing the layout will not affect the applications currently selected for each frame,
            it merely rearranges how they are displayed.
          </p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default LayoutPicker;
