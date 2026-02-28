/**
 * Dockview header action components.
 *
 * RightActions — "+" button (adjacent to tabs) followed by pane-specific
 * controls for the active panel. Sits on the same row as tabs. The
 * void-container flex-grow override in dockview-layout.module.css keeps
 * these elements adjacent to tabs instead of flushed to the far right.
 *
 * When the available width is too small for inline controls (e.g. multiple
 * tabs in a narrow panel), controls collapse into a single button that opens
 * a popover containing the full controls component.
 */

import {
  FunctionComponent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { IDockviewHeaderActionsProps, IDockviewPanel } from "dockview-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faSliders } from "@fortawesome/free-solid-svg-icons";
import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { addPaneInstance } from "store/framework";
import styles from "./dockview-header-actions.module.css";

import { EventInfoControls } from "components/panes/event-info";
import { VideoDLPaneControls, VideoOtherPaneControls } from "components/panes/video/video-controls";
import { PhotoControls } from "components/panes/photo";
import { PhotoAllControls } from "components/panes/photo-all";
import { ISSLocationControls } from "components/panes/iss-location";
import { GPSLocationControls } from "components/panes/gps-location";
import { CommControls } from "components/panes/comm";
import { GraphControls } from "components/panes/graph/graph";

const controlComponents: Record<PaneType, React.ComponentType<PaneComponentProps> | null> = {
  empty: null,
  video_downlink: VideoDLPaneControls,
  video_non_downlink: VideoOtherPaneControls,
  photo: PhotoControls,
  photo_all: PhotoAllControls,
  iss_location: ISSLocationControls,
  gps_location: GPSLocationControls,
  event_info: EventInfoControls,
  comm: CommControls,
  graph: GraphControls,
};

/** Width threshold (px) below which inline controls collapse into a button, keyed by paneType. */
const COLLAPSE_THRESHOLDS: Partial<Record<PaneType, number>> = {
  video_downlink: 220,
  video_non_downlink: 280,
  photo: 200,
  photo_all: 200,
  iss_location: 200,
  gps_location: 200,
  event_info: 200,
  comm: 200,
  graph: 200,
};

/** Extract the paneInstanceId from the active panel's params. */
function getActivePaneInstanceId(activePanel: IDockviewPanel | undefined): number {
  return (activePanel?.params?.paneInstanceId as number) ?? 0;
}

// Collapsed controls popover — shown when inline controls won't fit

// Fake dimensions passed to controls inside the popover so they always render in their expanded / wide layout (labels visible, full button rows).
// Value just exceeds the largest responsive breakpoint across all pane controls (video: 527px).

const POPOVER_DIMENSIONS: number[] = [560, 600];

interface CollapsedControlsProps {
  ControlComponent: React.ComponentType<PaneComponentProps>;
  paneInstanceId: number;
}

const CollapsedControls: FunctionComponent<CollapsedControlsProps> = ({
  ControlComponent,
  paneInstanceId,
}) => {
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  // After the popover renders (but before the browser paints), measure its actual
  // width and compute the correct position. Right-anchor to the button, clamped
  // so it never overflows either edge of the viewport.
  useLayoutEffect(() => {
    if (!open || !popoverRef.current || !buttonRef.current) return;
    const popoverWidth = popoverRef.current.offsetWidth;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const idealLeft = rect.right - popoverWidth;
    const left = Math.max(0, Math.min(idealLeft, viewportWidth - popoverWidth));
    setPopoverPos({ top: rect.bottom + 4, left });
    setVisible(true);
  }, [open]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setVisible(false);
    setOpen((prev) => !prev);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        className={styles.collapseButton}
        onClick={handleClick}
        title="Panel controls"
      >
        <FontAwesomeIcon icon={faSliders} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className={styles.controlsPopover}
            style={{
              top: popoverPos.top,
              left: popoverPos.left,
              visibility: visible ? "visible" : "hidden",
            }}
          >
            <ControlComponent
              paneInstanceId={paneInstanceId}
              groupDimensions={POPOVER_DIMENSIONS}
            />
          </div>,
          document.body
        )}
    </>
  );
};

// Right header actions — "+" button + controls

export const DockviewRightActions: FunctionComponent<IDockviewHeaderActionsProps> = ({
  group,
  containerApi,
}) => {
  const dispatch = useAppDispatch();

  const [paneInstanceId, setPaneInstanceId] = useState(() =>
    getActivePaneInstanceId(group.activePanel)
  );
  const [collapsed, setCollapsed] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const paneTypeRef = useRef<PaneType | "">("");

  const frameState = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId],
    shallowEqual
  );

  useEffect(() => {
    setPaneInstanceId(getActivePaneInstanceId(group.activePanel));
    const disposable = group.api.onDidActivePanelChange(() => {
      setPaneInstanceId(getActivePaneInstanceId(group.activePanel));
    });
    return () => disposable.dispose();
  }, [group]);

  // Keep paneTypeRef in sync so the ResizeObserver always reads the latest threshold
  const paneType = frameState?.paneType ?? "";
  useLayoutEffect(() => {
    paneTypeRef.current = paneType;
  });

  // Re-evaluate collapsed immediately when paneType (and thus threshold) changes
  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    const threshold = COLLAPSE_THRESHOLDS[paneType as PaneType] ?? 200;
    setCollapsed(width - 28 < threshold);
  }, [paneType]);

  // Observe right-actions width to decide inline vs collapsed controls
  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        // Reserve ~28px for the add button; rest is available for controls
        const threshold = COLLAPSE_THRESHOLDS[paneTypeRef.current as PaneType] ?? 200;
        setCollapsed(width - 28 < threshold);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Track group dimensions reactively so controls switch display modes on resize
  const [dimensions, setDimensions] = useState<number[]>(() => [
    group.width ?? 0,
    group.height ?? 0,
  ]);

  useEffect(() => {
    setDimensions([group.width ?? 0, group.height ?? 0]);
    const disposable = group.api.onDidDimensionsChange(({ width, height }) => {
      setDimensions([width, height]);
    });
    return () => disposable.dispose();
  }, [group]);

  const ControlComponent = paneType ? (controlComponents[paneType] ?? null) : null;

  const handleAddPanel = useCallback(() => {
    let maxId = 0;
    for (const panel of containerApi.panels) {
      const fId = (panel.params?.paneInstanceId as number) ?? 0;
      if (fId > maxId) maxId = fId;
    }
    const newPaneInstanceId = maxId + 1;
    dispatch(addPaneInstance(newPaneInstanceId));
    containerApi.addPanel({
      id: `paneInstance-${newPaneInstanceId}`,
      component: "pane",
      tabComponent: "paneTab",
      params: { paneInstanceId: newPaneInstanceId },
      position: { referenceGroup: group },
    });
  }, [containerApi, dispatch, group]);

  return (
    <div ref={actionsRef} className={styles.rightActions}>
      <button className={styles.addButton} onClick={handleAddPanel} title="Add panel">
        <FontAwesomeIcon icon={faPlus} />
      </button>
      {ControlComponent &&
        paneInstanceId > 0 &&
        (collapsed ? (
          <CollapsedControls ControlComponent={ControlComponent} paneInstanceId={paneInstanceId} />
        ) : (
          <div className={styles.controls}>
            <ControlComponent paneInstanceId={paneInstanceId} groupDimensions={dimensions} />
          </div>
        ))}
    </div>
  );
};
