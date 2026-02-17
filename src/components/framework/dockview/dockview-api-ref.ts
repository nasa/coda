/**
 * Module-level reference to the DockviewApi instance.
 *
 * Used by the share panel and preset picker to capture the current
 * Dockview layout state (via `api.toJSON()`) without prop-drilling
 * the API through the component tree.
 *
 * This has to be a separate files from the tsx because if vitest
 * imports it as tsx, tests fail under node environment.
 * (DockviewApi type references browser APIs, so importing the tsx
 * causes vitest to try to load the entire Dockview library
 * in node, which fails.)
 */

import type { DockviewApi } from "dockview-react";

let _api: DockviewApi | null = null;

export function setDockviewApi(api: DockviewApi | null): void {
  _api = api;
}

export function getDockviewApi(): DockviewApi | null {
  return _api;
}
