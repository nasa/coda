import { useState } from "react";
import { useAppSelector, deepEqual } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { changeLayout } from "store/framework";
import styles from "./layout-picker.module.css";
import { LayoutIcon } from "./layout-icons";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";

const LayoutPicker = ({ closeClick }: { closeClick?: () => void }): React.JSX.Element => {
  const frameworkState = useAppSelector((state) => state.framework, deepEqual);
  const [helpOpen, setHelpOpen] = useState(false);
  const dispatch = useAppDispatch();

  /**
   * Ordered list of layout preset letters for display in the layout picker.
   * Order here determines dropdown display order (not alphabetical).
   * Letters must never change — shared links reference them.
   */
  const allLayoutLetters: string[] = [
    "a",
    "b",
    "c",
    "j",
    "n",
    "k",
    "e",
    "d",
    "f",
    "g",
    "l",
    "m",
    "h",
    "i",
    "o",
    "p",
    "q",
    "r",
    "s",
  ];

  /**
   * Change the layout
   * @param index The index of the layout in allLayouts
   */
  const handleSelectLayout = (e: React.MouseEvent, index: string) => {
    e.preventDefault();
    // clientLogger.info({ logId: "user-select-layout", selectedLayout: index });
    dispatch(changeLayout(index));
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
