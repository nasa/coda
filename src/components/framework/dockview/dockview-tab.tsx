/**
 * Custom Dockview tab component.
 *
 * Shows the pane icon, short title, and a small chevron that opens the
 * pane picker dropdown (which also contains a "Close" action).
 * The rest of the tab is draggable by Dockview.
 */

import { FunctionComponent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IDockviewPanelHeaderProps } from "dockview-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faGripVertical } from "@fortawesome/free-solid-svg-icons";
import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { allPanes, removeFrame } from "store/framework";
import PanePickerModal from "../pane-picker";
import styles from "./dockview-tab.module.css";

interface PanelParams {
  paneInstanceId: number;
}

export const DockviewPaneTab: FunctionComponent<IDockviewPanelHeaderProps<PanelParams>> = ({
  api,
  params,
}) => {
  const paneInstanceId = params.paneInstanceId;
  const frameState = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId],
    shallowEqual
  );

  const paneType = frameState?.paneType ?? "empty";
  const paneInfo = allPanes[paneType];

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const chevronRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();

  const handleClose = useCallback(() => {
    dispatch(removeFrame(paneInstanceId));
    api.close();
  }, [api, dispatch, paneInstanceId]);

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!menuOpen && chevronRef.current) {
        const rect = chevronRef.current.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 2, left: rect.left });
      }
      setMenuOpen((prev) => !prev);
    },
    [menuOpen]
  );

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (chevronRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  };

  return (
    <div className={styles.tab} onMouseDown={handleMouseDown}>
      <FontAwesomeIcon icon={faGripVertical} className={styles.gripIcon} />
      {paneInfo?.icon && <FontAwesomeIcon icon={paneInfo.icon} className={styles.icon} />}
      <span>{paneInfo?.shortTitle ?? "None"}</span>
      <span
        ref={chevronRef}
        className={styles.chevron}
        onClick={handleChevronClick}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <FontAwesomeIcon icon={faChevronDown} />
      </span>
      {menuOpen &&
        // Using createPortal to render the menu at the body level, so it can overflow the tab and not be cut off by overflow:hidden styles in Dockview.
        createPortal(
          <div
            ref={overlayRef}
            className={styles.pickerOverlay}
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <PanePickerModal
              closeClick={() => setMenuOpen(false)}
              options={{ paneInstanceId: paneInstanceId }}
              onClosePanel={handleClose}
            />
          </div>,
          document.body
        )}
    </div>
  );
};
