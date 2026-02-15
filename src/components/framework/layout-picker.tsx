import { useState } from "react";
import { useAppSelector, deepEqual } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { changeLayout } from "store/framework";
import { allLayoutLetters, getFrameCount } from "./dockview-layouts";
import styles from "./layout-picker.module.css";
import { LayoutIcon } from "./layout-icons";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";

const LayoutPicker = ({ closeClick }: { closeClick?: () => void }): React.JSX.Element => {
  const frameworkState = useAppSelector((state) => state.framework, deepEqual);
  const [helpOpen, setHelpOpen] = useState(false);
  const dispatch = useAppDispatch();

  /** Select a layout preset and trim Redux frames to match its panel count. */
  const handleSelectLayout = (e: React.MouseEvent, letter: string) => {
    e.preventDefault();
    dispatch(changeLayout({ layout: letter, frameCount: getFrameCount(letter) }));
    closeClick?.();
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
        {allLayoutLetters.map((letter) => (
          <div
            className={`${styles.layout} ${
              letter === frameworkState.layout ? styles.layoutselected : ""
            }`}
            onClick={(e) => handleSelectLayout(e, letter)}
            key={`LAYOUT_${letter}`}
          >
            <LayoutIcon layout={letter} size="large" />
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
