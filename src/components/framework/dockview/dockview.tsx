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

import { FunctionComponent, useCallback, useEffect, useState } from "react";
import { DockviewReact, DockviewApi, DockviewReadyEvent, themeDark } from "dockview-react";
import type { IWatermarkPanelProps } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { addFrame } from "store/framework";
import { getLayout } from "./dockview-layout-definitions";
import { DockviewPanePanel } from "./dockview-pane-panel";
import { DockviewPaneTab } from "./dockview-tab";
import { DockviewRightActions } from "./dockview-header-actions";
import { setDockviewApi } from "./dockview-api-ref";
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

const DockviewLayout: FunctionComponent = () => {
  const [api, setApi] = useState<DockviewApi | null>(null);
  const layout = useAppSelector((state) => state.framework.layout, shallowEqual);
  const layoutLastChanged = useAppSelector(
    (state) => state.framework.layoutLastChanged,
    shallowEqual
  );
  const dockviewSnapshot = useAppSelector(
    (state) => state.framework.dockviewSnapshot ?? null,
    shallowEqual
  );

  const onReady = useCallback((event: DockviewReadyEvent) => {
    setApi(event.api);
    setDockviewApi(event.api);
  }, []);

  // Apply layout whenever the API becomes available or the layout changes
  useEffect(() => {
    if (!api) return;
    // If a serialized Dockview snapshot is available (v3 share/preset), use it directly.
    // Otherwise fall back to the layout letter system.
    if (dockviewSnapshot) {
      api.fromJSON(dockviewSnapshot);
    } else {
      const serializedLayout = getLayout(layout);
      api.fromJSON(serializedLayout);
    }
  }, [api, layout, layoutLastChanged, dockviewSnapshot]);

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
