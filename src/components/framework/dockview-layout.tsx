/**
 * DockviewLayout — replaces the CSS grid Viewer component.
 *
 * Mounts a `DockviewReact` instance and applies preset layouts from Redux.
 * When the `layout` letter changes in Redux, the corresponding Dockview
 * preset is loaded via `api.fromJSON()`.
 */

import { FunctionComponent, useCallback, useEffect, useState } from "react";
import { DockviewReact, DockviewApi, DockviewReadyEvent, themeDark } from "dockview-react";
import type { IWatermarkPanelProps } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";

import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import { getPresetLayout } from "./dockview-presets";
import { DockviewPanePanel } from "./dockview-pane-panel";
import { DockviewPaneTab } from "./dockview-tab";
import { DockviewRightActions } from "./dockview-header-actions";
import styles from "./dockview-layout.module.css";

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
const DockviewWatermark: FunctionComponent<IWatermarkPanelProps> = () => {
  return (
    <div className={styles.watermark}>
      <span>Drop a panel here or use + to add one</span>
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

  const onReady = useCallback((event: DockviewReadyEvent) => {
    setApi(event.api);
  }, []);

  // Apply layout whenever the API becomes available or the layout changes
  useEffect(() => {
    if (!api) return;
    const preset = getPresetLayout(layout);
    api.fromJSON(preset);
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
