# Dockview Refactor Notes

## Current Milestone

CSS grid layout system replaced with Dockview. All checks passing.

## Decisions Made

### 1. Layout-to-Dockview mapping

- Each CSS grid preset (a-s, 19 layouts) is translated to a Dockview serialized layout via a tree builder DSL.
- Using `api.fromJSON()` to load presets (precise control over proportions).
- Rationale: `addPanel` with relative positioning doesn't support proportional sizing.

### 2. Redux integration

- Keep existing Redux store (`framework` slice) for pane state management.
- Dockview manages the visual layout; Redux manages what's displayed in each panel.
- `layout` letter in Redux triggers Dockview `fromJSON` via useEffect.
- No Redux changes needed: all existing actions still work.

### 3. Panel/tab architecture

- Custom tab component (`dockview-tab.tsx`): shows pane icon + short title.
- Left header actions: pane picker dropdown (change active panel's pane type).
- Right header actions: pane-specific controls for the active panel.
- Panel content (`dockview-pane-panel.tsx`): just the pane body (no internal header).
- Both header actions subscribe to `onDidActivePanelChange` for tab-switch reactivity.

### 4. Share link backward compatibility

- v1.0 and v2.0 share links continue to decode via existing `interpretFramestateQueryString`.
- Share links use the preset layout letter; Dockview applies the matching preset.
- Custom drag rearrangements are ephemeral (not encoded in share links).
- Rationale: minimal change, presets are the primary mechanism.
- `generateShareURL` unchanged — still reads layout letter and frame state from Redux.

### 5. Frame dimensions

- Use Dockview panel API `width`/`height` + `onDidDimensionsChange` instead of ResizeObserver/setTimeout.

### 6. Package

- `dockview-react` 4.13.1 installed as pinned devDependency (matches project convention).
- CSS theme: `dockview-theme-dark` with custom variable overrides to match app dark theme.

### 7. LayoutPicker

- No changes needed. Still dispatches `changeLayout(letter)` to Redux.
- Miniature layout icons still render via CSS grid classes from `frames.module.css`.
- DockviewLayout watches `layout` + `layoutLastChanged` and applies preset via `fromJSON`.

## Files Created

- `src/components/framework/dockview-presets.ts` — tree DSL + all 19 preset layouts
- `src/components/framework/dockview-pane-panel.tsx` — panel content renderer
- `src/components/framework/dockview-pane-panel.module.css` — empty pane placeholder styles
- `src/components/framework/dockview-tab.tsx` — custom tab component
- `src/components/framework/dockview-header-actions.tsx` — left (pane picker) + right (controls) header actions
- `src/components/framework/dockview-header-actions.module.css` — dropdown/control styles
- `src/components/framework/dockview-layout.tsx` — main DockviewReact container
- `src/components/framework/dockview-layout.module.css` — container height + dockview theme overrides

## Files Modified

- `src/pages/view/index.tsx` — import DockviewLayout instead of Viewer
- `package.json` — added dockview-react 4.13.1

## Files Kept (not removed)

- `src/components/framework/frames.tsx` — old Viewer, still imported by LayoutPicker for CSS class exports
- `src/components/framework/frames.module.css` — CSS grid layouts, used by LayoutPicker icon rendering
- `src/components/framework/frame.tsx` — old Frame component, still usable but no longer imported by main view

## Commands Run

- `npm install --save-dev dockview-react` — success
- `npm run tsc` — 0 errors
- `npm run lint` — 0 errors
- `npm run lint:css` — 0 errors
- `npm run test` — 18 test files, 348 tests, all passing

## Known Issues / TODO

- Dockview drag rearrangements are ephemeral (not persisted in share links). A v3.0 share link format could serialize Dockview layout state if needed.
- `frame.tsx` and its styles are still imported by `frames.tsx` for the LayoutPicker. Could be cleaned up if LayoutPicker icon rendering is refactored.
- Dockview theme CSS overrides may need tuning to exactly match existing visual design once tested in browser.
