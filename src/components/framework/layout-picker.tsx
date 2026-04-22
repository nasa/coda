import { useState } from "react";
import { useAppDispatch } from "utils/useAppDispatch";
import { changeLayout } from "store/framework";
import {
  visibleLayoutLetters,
  getPaneInstanceCount,
  LayoutLetter,
} from "./dockview/dockview-layout-definitions";
import styles from "./layout-picker.module.css";
import { LayoutIcon } from "./layout-icons";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";

const LayoutPicker = ({ closeClick }: { closeClick?: () => void }): React.JSX.Element => {
  const [helpOpen, setHelpOpen] = useState(false);
  const dispatch = useAppDispatch();

  /** Select a layout preset and trim Redux paneInstanceCount to match the new panel count.
   * This stops pane states from being orphaned when the number of panes decreases */
  const handleSelectLayout = (e: React.MouseEvent, letter: LayoutLetter) => {
    e.preventDefault();
    dispatch(changeLayout({ layout: letter, paneInstanceCount: getPaneInstanceCount(letter) }));
    closeClick?.();
  };

  return (
    <div className={styles.main}>
      <div className={styles.top}>
        <div className={styles.intro}>
          Select a layout below or drag each panel to reposition or{" "}
          <span className={styles.noWrap}>
            scale&nbsp;
            <span className={styles.helpInline}>
              <HelpButton
                clickHandler={() => {
                  setHelpOpen(!helpOpen);
                }}
              />
            </span>
          </span>
        </div>
        {closeClick && (
          <div className={styles.close} onClick={closeClick}>
            ✕
          </div>
        )}
      </div>
      <div className={styles.layouts}>
        {visibleLayoutLetters.map((letter) => (
          <div
            className={styles.layout}
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
            CODA Layouts sets the initial number of visible application panels and how they are
            displayed. After selection, the layout can be further customized by dragging panels to
            rearrange them, and closing or adding panels as needed.
          </p>
          <p>
            Changing the layout will not affect the applications currently selected for each panel,
            it merely rearranges how they are displayed.
          </p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default LayoutPicker;
