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
import { addFrame } from "store/framework";
import styles from "./dockview-header-actions.module.css";

import { EventInfoControls } from "components/panes/event-info";
import { VideoDLPaneControls, VideoOtherPaneControls } from "components/panes/video/video-controls";
import { PhotoControls } from "components/panes/photo";
import { PhotoAllControls } from "components/panes/photo-all";
import { ISSLocationControls } from "components/panes/iss-location";
import { GPSLocationControls } from "components/panes/gps-location";
import { CommControls } from "components/panes/comm";
import { GraphControls } from "components/panes/graph/graph";

const controlComponents: Record<string, React.ComponentType<PaneComponentProps> | null> = {
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

/** Width threshold (px) below which inline controls collapse into a button. */
const COLLAPSE_THRESHOLD = 200;

/** Extract the frameId from the active panel's params. */
function getActiveFrameId(activePanel: IDockviewPanel | undefined): number {
  return (activePanel?.params?.frameId as number) ?? 0;
}

// Collapsed controls popover — shown when inline controls won't fit

// Fake dimensions passed to controls inside the popover so they always render in their expanded / wide layout (labels visible, full button rows).
// Value just exceeds the largest responsive breakpoint across all pane controls (video: 527px).

const POPOVER_DIMENSIONS: number[] = [560, 600];

interface CollapsedControlsProps {
  ControlComponent: React.ComponentType<PaneComponentProps>;
  frameId: number;
}

const CollapsedControls: FunctionComponent<CollapsedControlsProps> = ({
  ControlComponent,
  frameId,
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
            <ControlComponent frameID={frameId} frameDimensions={POPOVER_DIMENSIONS} />
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

  const [frameId, setFrameId] = useState(() => getActiveFrameId(group.activePanel));
  const [collapsed, setCollapsed] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  const frameState = useAppSelector((state) => state.framework.frames[frameId], shallowEqual);

  useEffect(() => {
    setFrameId(getActiveFrameId(group.activePanel));
    const disposable = group.api.onDidActivePanelChange(() => {
      setFrameId(getActiveFrameId(group.activePanel));
    });
    return () => disposable.dispose();
  }, [group]);

  // Observe right-actions width to decide inline vs collapsed controls
  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        // Reserve ~28px for the add button; rest is available for controls
        setCollapsed(width - 28 < COLLAPSE_THRESHOLD);
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

  const paneType = frameState?.paneType ?? "";
  const ControlComponent = paneType ? (controlComponents[paneType] ?? null) : null;

  const handleAddPanel = useCallback(() => {
    let maxId = 0;
    for (const panel of containerApi.panels) {
      const fId = (panel.params?.frameId as number) ?? 0;
      if (fId > maxId) maxId = fId;
    }
    const newFrameId = maxId + 1;
    dispatch(addFrame(newFrameId));
    containerApi.addPanel({
      id: `frame-${newFrameId}`,
      component: "pane",
      tabComponent: "paneTab",
      params: { frameId: newFrameId },
      position: { referenceGroup: group },
    });
  }, [containerApi, dispatch, group]);

  return (
    <div ref={actionsRef} className={styles.rightActions}>
      <button className={styles.addButton} onClick={handleAddPanel} title="Add panel">
        <FontAwesomeIcon icon={faPlus} />
      </button>
      {ControlComponent &&
        frameId > 0 &&
        (collapsed ? (
          <CollapsedControls ControlComponent={ControlComponent} frameId={frameId} />
        ) : (
          <div className={styles.controls}>
            <ControlComponent frameID={frameId} frameDimensions={dimensions} />
          </div>
        ))}
    </div>
  );
};
