/**
 * Module-level reference to the DockviewApi instance.
 *
 * Used by the share panel and preset picker to capture the current
 * Dockview layout state (via `api.toJSON()`) without prop-drilling
 * the API through the component tree.
 */

import type { DockviewApi } from "dockview-react";

let _api: DockviewApi | null = null;

export function setDockviewApi(api: DockviewApi | null): void {
  _api = api;
}

export function getDockviewApi(): DockviewApi | null {
  return _api;
}
