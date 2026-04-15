/**
 * DockviewLayout — Main `DockviewReact` container, theme overrides, watermark
 * Replaces the CSS grid Viewer component.
 *
 * Mounts a `DockviewReact` instance and applies layouts from Redux.
 * When the `layout` letter changes in Redux, the corresponding Dockview
 * layout is loaded via `api.fromJSON()`.
 *
 * Nomenclature:
 * - "Pane": a single CODA content panel (e.g. video, photo, graph)
 * - "Panel": a Dockview panel, which wraps a Pane and provides controls (move, close)
 * - "Group": a Dockview group, which contains one or more Panels and provides layout (tabbed, stacked, etc)
 */

import { FunctionComponent, useCallback, useEffect, useRef, useState } from "react";
import {
  DockviewReact,
  DockviewApi,
  DockviewReadyEvent,
  SerializedDockview,
  themeDark,
} from "dockview-react";
import type { IWatermarkPanelProps } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { addPaneInstance } from "store/framework";
import { getLayout } from "./dockview-layout-definitions";
import { DockviewPanePanel } from "./dockview-pane-panel";
import { DockviewPaneTab } from "./dockview-tab";
import { DockviewRightActions } from "./dockview-header-actions";
import { setDockviewApi, getPendingDockviewLayout } from "./dockview-api-ref";
import styles from "./dockview.module.css";

const components = {
  pane: DockviewPanePanel,
};

const tabComponents = {
  paneTab: DockviewPaneTab,
};

/** Custom theme: dark base with visible gap between groups */
const customTheme = {
  ...themeDark,
  name: "coda-dark",
  gap: 3,
};

/** Watermark shown when a group has no panels (all were closed/moved) */
const DockviewWatermark: FunctionComponent<IWatermarkPanelProps> = ({ containerApi }) => {
  const dispatch = useAppDispatch();

  const handleAddPanel = useCallback(() => {
    if (!containerApi) return;

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
    });
  }, [dispatch, containerApi]);

  return (
    <div className={styles.watermark}>
      <span>Use</span>
      <button className={styles.watermarkButton} onClick={handleAddPanel} title="Add panel">
        <FontAwesomeIcon icon={faPlus} />
      </button>
      <span>to add a new panel</span>
    </div>
  );
};

const DockviewLayout: FunctionComponent<{ initialLayout?: SerializedDockview | null }> = ({
  initialLayout,
}) => {
  const [api, setApi] = useState<DockviewApi | null>(null);
  const layout = useAppSelector((state) => state.framework.layout, shallowEqual);
  const layoutLastChanged = useAppSelector(
    (state) => state.framework.layoutLastChanged,
    shallowEqual
  );
  // Track whether we've applied the URL-supplied initial layout (apply it only once).
  const initialLayoutApplied = useRef(false);
  // Capture the mount-time initialLayout in a ref so that re-renders of the
  // parent (which recreate the SerializedDockview object each time via
  // getURLParams) don't create a new effect dependency and re-fire the effect
  // after the dv layout has already been applied.
  const initialLayoutRef = useRef(initialLayout);
  const onReady = useCallback((event: DockviewReadyEvent) => {
    setApi(event.api);
    setDockviewApi(event.api);
  }, []);

  // Apply layout whenever the API becomes available or the layout changes.
  // On the very first run (api just became available), prefer the URL-supplied
  // initialLayout if present.  Subsequent runs (layout changes from preset
  // picker, layout button, etc.) use the pending layout or letter-layout path.
  useEffect(() => {
    if (!api) return;
    if (initialLayoutRef.current && !initialLayoutApplied.current) {
      initialLayoutApplied.current = true;
      api.fromJSON(initialLayoutRef.current);
      return;
    }
    const pendingLayout = getPendingDockviewLayout();
    if (pendingLayout) {
      api.fromJSON(pendingLayout);
    } else {
      const serializedLayout = getLayout(layout);
      api.fromJSON(serializedLayout);
    }
  }, [api, layout, layoutLastChanged]);

  return (
    <div className={styles.container}>
      <DockviewReact
        components={components}
        tabComponents={tabComponents}
        rightHeaderActionsComponent={DockviewRightActions}
        watermarkComponent={DockviewWatermark}
        onReady={onReady}
        theme={customTheme}
      />
    </div>
  );
};

export default DockviewLayout;
