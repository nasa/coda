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

let _pendingSnapshot: SerializedDockview | null = null;

/**
 * Stash a Dockview layout snapshot to be applied on next initialization.
 * Called by URL parsing and preset loading before the Dockview API is ready,
 * so DockviewLayout can consume it instead of falling back to the layout letter.
 */
export function setPendingDockviewSnapshot(snapshot: SerializedDockview | null): void {
  _pendingSnapshot = snapshot;
}

/** Consume and clear the pending snapshot (returns null if none is set). */
export function takePendingDockviewSnapshot(): SerializedDockview | null {
  const snapshot = _pendingSnapshot;
  _pendingSnapshot = null;
  return snapshot;
}
