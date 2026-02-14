# Dockview Refactor Notes

## Current Milestone

Responsive pane controls: when a panel's tab row is too narrow for inline controls (< 200px available), controls collapse into a single slider-icon button that opens a popover with the full controls. All checks passing.

## Decisions Made

### 1. Layout-to-Dockview mapping

- Each CSS grid preset (a-s, 19 layouts) is translated to a Dockview serialized layout via a tree builder DSL.
- Using `api.fromJSON()` to load presets (precise control over proportions).
- Rationale: `addPanel` with relative positioning doesn't support proportional sizing.

### 2. Redux integration

- Keep existing Redux store (`framework` slice) for pane state management.
- Dockview manages the visual layout; Redux manages what's displayed in each panel.
- `layout` letter in Redux triggers Dockview `fromJSON` via useEffect.
- Added `addFrame` reducer for dynamic panel creation via the "+" button.
- Added `removeFrame` reducer for panel deletion via the tab close button.

### 3. Panel/tab architecture (revised x2)

- Custom tab component (`dockview-tab.tsx`): shows pane icon + short title + chevron dropdown.
- Chevron on tab opens pane picker dropdown (via portal to avoid clipping). Compact and doesn't interfere with tab drag.
- Close button **removed from tab** — saves horizontal space. "Close Panel" option added to the bottom of the pane picker dropdown instead.
- Left header actions: **removed** — pane picker moved to tab chevron.
- Right header actions: pane-specific controls (for active panel) + "+" add-panel button.
- Panel content (`dockview-pane-panel.tsx`): pane body only, or watermark pane picker for empty panes.

### 4. Controls back in tab row (revised x2)

- **Previous (v1)**: controls in right header actions — got flushed to far right by flex-grow on void container.
- **Previous (v2)**: controls as a 30px toolbar in panel body — worked but took vertical space and COM channels dropdown was clipped by `overflow: hidden`.
- **Now (v3)**: controls back in right header actions, with CSS overrides to fix positioning:
  - `.dv-void-container { flex-grow: 0 }` — stops empty space from pushing controls right.
  - `.dv-right-actions-container { flex: 1 }` — controls fill remaining space after tabs.
  - `.dv-tabs-and-actions-container { position: relative; z-index: 2 }` — lets dropdowns (e.g. COM channels) render above panel content.
- Controls use `overflow-x: clip` (not `overflow: hidden`) so vertical dropdowns are not clipped.
- Right actions track active panel via `group.onDidActivePanelChange`, render appropriate ControlComponent.

### 5. Watermark / empty panel UX (revised)

- When pane type is "empty", the panel body shows a grid of available pane types to choose from.
- "Select a display type" title text removed — the grid is self-explanatory.
- "empty" pane type filtered from both the watermark grid and the tab chevron PanePickerModal — users can't select an empty state from a dropdown (new panels start empty, close button removes panels).
- Uses `getAvailablePanesForSource()` to filter panes by current data source.
- Separate `watermarkComponent` on DockviewReact handles fully empty groups (all panels moved/closed).

### 6. Add panel ("+" button)

- "+" button in right header actions creates a new panel in the current group.
- Generates the next available frameId by scanning all existing panel params.
- Dispatches `addFrame(newFrameId)` to Redux, then calls `containerApi.addPanel()`.
- New panel starts with "empty" pane type, showing the watermark pane picker.

### 7. Panel gaps and resize handles

- Using Dockview `theme` prop with `gap: 3` for visible gaps between groups.
- Custom theme extends `themeDark` from dockview-react.
- Sash (resize handle) styled with `--dv-sash-color` and `--dv-active-sash-color` CSS variables.
- Gap creates clear visual separation between panels; sash hover color provides resize affordance.

### 8. Pane picker dropdown styling (revised)

- Background changed from `--lightest-grey` to `--nearly-black` to match panel tab styling.
- Font size reduced from 15px to 12px to match tab text.
- Width reduced from 275px to 200px for compact appearance.
- Colored icon backgrounds (squares) replaced with colored icon text — icons are now inline with color applied via CSS `color` property instead of `background-color`.
- Option height reduced from 28px to 24px for compactness.
- Border between options changed to `--dark-grey` for visibility against the dark background.
- Subtle `1px solid var(--dark-grey)` border around the dropdown for definition.

### 9. Tab text visibility (revised)

- Hidden (inactive) tab text was too dim.
- `--dv-activegroup-hiddenpanel-tab-color` brightened from `#999999` to `#bbbbbb`.
- `--dv-inactivegroup-hiddenpanel-tab-color` brightened from `#777777` to `#999999`.

### 10. Share link backward compatibility

- v1.0 and v2.0 share links continue to decode via existing `interpretFramestateQueryString`.
- Share links use the preset layout letter; Dockview applies the matching preset.
- Custom drag rearrangements are ephemeral (not encoded in share links).
- `generateShareURL` unchanged — still reads layout letter and frame state from Redux.

### 11. Frame dimensions

- Use Dockview panel API `width`/`height` + `onDidDimensionsChange` instead of ResizeObserver/setTimeout.

### 12. Package

- `dockview-react` 4.13.1 installed as pinned devDependency (matches project convention).
- CSS theme: custom theme extending `themeDark` with variable overrides.

### 13. LayoutPicker

- No changes needed. Still dispatches `changeLayout(letter)` to Redux.
- Miniature layout icons still render via CSS grid classes from `frames.module.css`.
- DockviewLayout watches `layout` + `layoutLastChanged` and applies preset via `fromJSON`.

### 14. Responsive pane controls collapse

- When a panel group has multiple tabs and limited horizontal space, inline pane controls would get crushed.
- Added a `ResizeObserver` on the right-actions container that measures available width.
- When available width (minus add-button) falls below 200px, inline controls are replaced with a single button (sliders icon).
- Clicking the button opens a portal-based popover anchored below the button, containing the full controls component.
- **Popover renders expanded controls**: fake `frameDimensions` of `[800, 600]` are passed to the controls inside the popover, ensuring they always render in their wide/expanded layout (labels visible, full button rows) regardless of actual panel size.
- Popover `min-width: 400px`, no max-width cap, `overflow: visible` — wide enough for expanded controls, and allows nested dropdowns (e.g. comm channel selector) to render outside the popover boundaries without clipping.
- Popover styled with `--nearly-black` background, dark-grey border, and drop shadow to match the tab styling.
- Position computed in click handler (not render) to avoid ref-during-render lint issues.
- Outside-click dismisses the popover.

## Files Created

- `src/components/framework/dockview-presets.ts` — tree DSL + all 19 preset layouts
- `src/components/framework/dockview-pane-panel.tsx` — panel content renderer + controls toolbar + watermark pane picker
- `src/components/framework/dockview-pane-panel.module.css` — controls toolbar + watermark pane picker styles
- `src/components/framework/dockview-tab.tsx` — custom tab with chevron pane picker + close button
- `src/components/framework/dockview-tab.module.css` — tab, chevron, and close button styles
- `src/components/framework/dockview-header-actions.tsx` — "+" button only
- `src/components/framework/dockview-header-actions.module.css` — add button styles
- `src/components/framework/dockview-layout.tsx` — main DockviewReact container
- `src/components/framework/dockview-layout.module.css` — container height + theme overrides + watermark

## Files Modified

- `src/pages/view/index.tsx` — import DockviewLayout instead of Viewer
- `src/store/framework.ts` — added `addFrame` + `removeFrame` reducers + exported actions
- `src/components/framework/pane-picker.tsx` — filtered "empty" from available panes
- `src/components/framework/pane-picker.module.css` — restyled to match tab styling (--nearly-black bg, 12px font, colored icon text)
- `package.json` — added dockview-react 4.13.1

## Files Kept (not removed)

- `src/components/framework/frames.tsx` — old Viewer, still imported by LayoutPicker for CSS class exports
- `src/components/framework/frames.module.css` — CSS grid layouts, used by LayoutPicker icon rendering
- `src/components/framework/frame.tsx` — old Frame component, still usable but no longer imported by main view
- `src/components/framework/dockview-shared.module.css` — orphaned (no imports), can be deleted

## Commands Run

- `npm install --save-dev dockview-react` — success
- `npm run tsc` — 0 errors
- `npm run lint` — 0 errors
- `npm run lint:css` — 0 errors
- `npm run test` — 18 test files, 348 tests, all passing

## Known Issues / TODO

- Dockview drag rearrangements are ephemeral (not persisted in share links). A v3.0 share link format could serialize Dockview layout state if needed.
- `frame.tsx` and its styles are still imported by `frames.tsx` for the LayoutPicker. Could be cleaned up if LayoutPicker icon rendering is refactored.
- `dockview-shared.module.css` is orphaned and can be deleted.
- Dynamically added panels (via "+") are not persisted across layout changes — switching presets resets to the preset's frame count.
- Individual pane control components (comm, video-controls, etc.) retain their own internal CSS for dropdowns/buttons. These could be further unified to use `--nearly-black` backgrounds if desired.
