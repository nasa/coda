/**
 * DockviewLayout — replaces the CSS grid Viewer component.
 *
 * Mounts a `DockviewReact` instance and applies preset layouts from Redux.
 * When the `layout` letter changes in Redux, the corresponding Dockview
 * preset is loaded via `api.fromJSON()`.
 */

import { FunctionComponent, useCallback, useEffect, useState } from "react";
import { DockviewReact, DockviewApi, DockviewReadyEvent } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";

import { shallowEqual, useAppSelector } from "utils/useAppSelector";
import { getPresetLayout } from "./dockview-presets";
import { DockviewPanePanel } from "./dockview-pane-panel";
import { DockviewPaneTab } from "./dockview-tab";
import { DockviewLeftActions, DockviewRightActions } from "./dockview-header-actions";
import styles from "./dockview-layout.module.css";

const components = {
  pane: DockviewPanePanel,
};

const tabComponents = {
  paneTab: DockviewPaneTab,
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
        leftHeaderActionsComponent={DockviewLeftActions}
        rightHeaderActionsComponent={DockviewRightActions}
        onReady={onReady}
        className="dockview-theme-dark"
      />
    </div>
  );
};

export default DockviewLayout;
