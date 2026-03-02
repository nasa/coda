/**
 * This has to be a separate file from the tsx because if vitest imports it as
 * tsx, tests fail under node environment. (DockviewApi type references browser
 * APIs, so importing the tsx causes vitest to try to load the entire Dockview
 * library in node, which fails.)
 */

import type { DockviewApi, SerializedDockview } from "dockview-react";

let _api: DockviewApi | null = null;

/** Store the live DockviewApi instance once Dockview fires its onReady event. */
export function setDockviewApi(api: DockviewApi | null): void {
  _api = api;
}

/**
 * Returns the live DockviewApi instance.
 * Used by the share panel and preset picker to capture the current Dockview
 * layout state (via `api.toJSON()`) without prop-drilling the API through the
 * component tree.
 */
export function getDockviewApi(): DockviewApi | null {
  return _api;
}

let _pendingLayout: SerializedDockview | null = null;

/**
 * Stash a Dockview layout to be applied on next layout change.
 * Called by the preset picker so that DockviewLayout applies the correct layout when the user selects a preset.
 */
export function setPendingDockviewLayout(layout: SerializedDockview | null): void {
  _pendingLayout = layout;
}

/** Get and clear the pending layout, if any. Called by DockviewLayout on layout changes. */
export function getPendingDockviewLayout(): SerializedDockview | null {
  const layout = _pendingLayout;
  _pendingLayout = null;
  return layout;
}
