# Dockview Window Management — Feature Branch Overview for Jackie

This document provides technical details for the Dockview window management feature branch. For a summary of changes, see the MR description.

## Overview

This branch replaces the old CSS grid-based frame layout system with [Dockview](https://dockview.dev/), a professional window management library that provides draggable, resizable, tabbed panels with full serialization support.

**Key architectural principle:** Redux never knows about panel positions or group splits. Dockview never knows about video channels, map lock toggles, or filter states. The bridge between them is the **`frameId`** — an integer identifier assigned to each panel at creation time and passed through Dockview's `params` mechanism.

## Components

### Panel/tab

| File                             | Purpose                                                           |
| -------------------------------- | ----------------------------------------------------------------- |
| `dockview.tsx`                   | Main `DockviewReact` container, theme overrides, watermark        |
| `dockview-pane-panel.tsx`        | Panel content: renders pane body or empty-state watermark picker  |
| `dockview-tab.tsx`               | Custom tab: icon + short title + chevron for pane picker dropdown |
| `dockview-header-actions.tsx`    | Right header "+" button + inline/collapsed pane controls          |
| `dockview-layout-definitions.ts` | All 19 serialized Dockview layout presets (letters a–s)           |
| `layout-icons.tsx`               | Inline SVG layout icons for picker and header                     |
| `pane-picker.tsx`                | Dropdown list of available pane types                             |

### Layout presets

- 19 preset layouts (letters a–s) are defined as Dockview serialized JSON trees in `dockview-layout-definitions.ts`
- Layout icons are rendered as lightweight inline SVGs based on the Dockview JSON trees.

## Data Flow

### 1. Initial Load / Share Link

**v3 Share Links** (current format — captures exact Dockview layout):

```
URL query params: ?v=3.0&dv={compressed_layout}&f1=0101&f2=0100...
    ↓
view/index.tsx: getURLParams() decompresses dv param → SerializedDockview JSON
    ↓
dispatch(setAllFrameworkState({
  dockviewSnapshot: {decompressed JSON},
  frames: { 1: {...}, 2: {...} }
}))
    ↓
Redux framework slice updates: dockviewSnapshot={...}, frames={...}
    ↓
DockviewLayout reads dockviewSnapshot from Redux → api.fromJSON(dockviewSnapshot)
    ↓
Dockview restores exact panel positions, splits, proportions from serialized state
    ↓
Each panel's DockviewPanePanel reads state.framework.frames[frameId] to render the right pane
```

**v2 Share Links** (legacy format — layout letter system):

```
URL query params: ?v=2.0&l=j&f1=0101&f2=0100...
    ↓
view/index.tsx: getURLParams() parses layout letter
    ↓
dispatch(setAllFrameworkState({
  layout: "j",
  dockviewSnapshot: null,
  frames: { 1: {...}, 2: {...} }
}))
    ↓
Redux framework slice updates: layout="j", dockviewSnapshot=null, frames={...}
    ↓
DockviewLayout reads layout from Redux → getLayout("j") → api.fromJSON(layout)
    ↓
Dockview creates panels from predefined layout definition
    ↓
Each panel's DockviewPanePanel reads state.framework.frames[frameId] to render the right pane
```

### 2. User Picks a New Layout (from Layout Picker)

```
LayoutPicker dispatches changeLayout({ layout: "e", frameCount: 4 }) (Let's assume the current view has 5 panels open)
    ↓
Redux: layout="e", layoutLastChanged=Date.now(), dockviewSnapshot=null
  + frames trimmed to keys 1–4 (keys 5+ deleted)
    ↓
DockviewLayout effect fires → getLayout("e") → api.fromJSON(layout)
    ↓
Entire Dockview tree is replaced with the new predefined layout's panel structure
    ↓
Panels 1–4 read their pane types from Redux frames (preserving existing selections)
Any panel added later via "+" gets a fresh empty frame → watermark picker
```

Switching layouts via the picker clears any custom drag arrangements and returns to the predefined layout template.

### 3. User Changes a Pane Type (via tab dropdown or watermark picker)

```
PanePicker dispatches setPaneType({ frameID: 3, paneType: "comm" })
    ↓
Redux: frames[3] = { paneType: "comm", paneStateData: {defaults...} }
    ↓
DockviewPanePanel re-renders — paneComponents["comm"] → <CommPane>
    ↓
DockviewRightActions re-renders — controlComponents["comm"] → <CommControls>
```

Dockview is not involved at all — no panels are added, removed, or moved. Only the content inside the existing panel changes.

### 4. Pane Internal State Changes

```
User clicks "Lock Scroll" in CommPane
    ↓
dispatch(setPaneStateDataValue({ frameID: 3, paneStateProperty: "lockScroll", paneStateValue: true }))
    ↓
Redux: frames[3].paneStateData.lockScroll = true
    ↓
CommPane re-renders with the new state
```

Again, Dockview is uninvolved. All pane-internal state flows through Redux.

### 5. User Adds a Panel (via "+" button)

```
DockviewRightActions: finds max frameId across all panels, assigns newFrameId = max + 1
    ↓
dispatch(addFrame(newFrameId))  — creates Redux state for the new frame
    ↓
containerApi.addPanel({ id: `frame-${newFrameId}`, params: { frameId: newFrameId } })
    ↓
Dockview creates the panel in the current group
    ↓
DockviewPanePanel sees paneType="empty" → shows watermark picker
```

This is the only place where Dockview and Redux are both mutated in the same action — Redux gets the frame state, Dockview gets the panel.

### 6. User Closes a Panel (via tab dropdown)

```
DockviewPaneTab: dispatch(removeFrame(frameId)) + api.close()
    ↓
Redux removes frames[frameId]
Dockview removes the panel from the group
```

### 7. User Drags a Panel to Rearrange

```
User drags a tab to a different group, resizes splits, etc.
    ↓
Dockview handles this entirely — groups, splits, sizes change
    ↓
Redux is NOT updated — the layout letter and frame state remain the same
    ↓
The panel keeps its frameId param, so it continues reading the correct Redux state
```

**v3 Behavior**: Drag rearrangements are **captured** when generating v3 share links or saving presets. The app calls `api.toJSON()` to serialize the current Dockview state, compresses it, and stores it in the `dv` URL parameter or preset's `dockviewSnapshot` field. When the link/preset is loaded, the exact arrangement is restored.

## `frameId` as a Bridge

Every Dockview panel is created with a `params: { frameId: N }` object. This integer is the key that connects the two systems:

- **Dockview side**: `DockviewPanePanel` receives `params.frameId` from the Dockview API
- **Redux side**: `state.framework.frames[frameId]` holds the pane type and all pane-specific state
- **Pane components**: Receive `frameID` as a prop, use it to select their Redux state and dispatch state updates

The `frameId` is assigned by the layout definitions (frames 1–N for N-panel layouts) or dynamically when adding panels via the "+" button (max existing ID + 1).

## Layout Letter vs Redux Layout State

The `layout` field in the Redux `framework` slice is a **layout identifier** for predefined templates. It coexists with the newer `dockviewSnapshot` field (v3 serialized state).

**Current role of layout letters**:

| Purpose                                                        | Consumer              | Notes                                       |
| -------------------------------------------------------------- | --------------------- | ------------------------------------------- |
| Initialize Dockview from predefined templates                  | `dockview-layout.tsx` | Only used when `dockviewSnapshot` is null   |
| Show the currently selected layout icon in the header          | `header.tsx`          | Visual indicator only                       |
| Highlight the active layout in the layout picker               | `layout-picker.tsx`   | User can click to switch to template        |
| Fallback for v2 share links (`&l=j`)                           | `share-state.ts`      | Legacy support                              |
| Stored in v3 presets for compatibility (unused during restore) | `preset-picker.tsx`   | Field exists but `dockviewSnapshot` is used |

**Priority when loading**:

```tsx
// In DockviewLayout component
if (dockviewSnapshot) {
  // v3: restore exact serialized state
  api.fromJSON(dockviewSnapshot);
} else {
  // v2 fallback: use predefined layout template
  const serializedLayout = getLayout(layout);
  api.fromJSON(serializedLayout);
}
```

**Flow when switching layouts via Layout Picker**:

1. User clicks layout "e" in picker
2. Redux: `layout="e"`, `layoutLastChanged=Date.now()`, `dockviewSnapshot=null`
3. `DockviewLayout` sees `dockviewSnapshot` is null → calls `getLayout("e")`
4. Predefined template replaces current arrangement

**Flow when loading a v3 preset/share link**:

1. URL has `dv={compressed}` or preset has `dockviewSnapshot={...}`
2. Redux: `dockviewSnapshot={serialized}`, `layout` is ignored
3. `DockviewLayout` sees `dockviewSnapshot` is set → calls `api.fromJSON(dockviewSnapshot)`
4. Custom arrangement is restored, **not** the template for the layout letter

The layout letter system remains for:

- Quick switching between predefined templates (Layout Picker)
- Default layouts for different sources (ISS, NBL, ARTEMIS)
- Backward compatibility with v2 share links

Once a user drags panels or saves a v3 preset, the layout letter becomes a label rather than the active layout definition. The `dockviewSnapshot` field takes precedence.

## Panel Dimensions

Panel dimensions come from **Dockview**, not Redux:

```tsx
// In DockviewPanePanel
const [dimensions, setDimensions] = useState([api.width, api.height]);
useEffect(() => {
  const disposable = api.onDidDimensionsChange(({ width, height }) => {
    setDimensions([width, height]);
  });
  return () => disposable.dispose();
}, [api]);

// Passed to pane as frameDimensions prop
<PaneComponent frameID={frameId} frameDimensions={dimensions} />;
```

This replaces the old ResizeObserver approach. The `frameDimensions` prop is used by panes for responsive behavior (e.g., map resize invalidation, collapsed controls threshold).

## Presets

User presets allow saving and restoring complete layout configurations (panel arrangement + pane content).

**Saving a Preset** (v3 format):

```
User clicks "Save" in PresetPicker
    ↓
const dockviewApi = getDockviewApi();
const newPreset: Preset = {
  uuid: uuidv4(),
  name: presetNameField,
  layout: framework.layout,          // letter kept for fallback/compatibility
  frames: framework.frames,           // pane types and state
  version: 3,
  dockviewSnapshot: dockviewApi.toJSON()  // full Dockview serialization
};
    ↓
Presets stored in browser cookie (CODA_UserPresets), LZUTF8 compressed
```

**Loading a Preset**:

```
User clicks preset in PresetPicker
    ↓
dispatch(setAllFrameworkState({
  layout: preset.layout,
  frames: preset.frames,
  dockviewSnapshot: preset.version === 3 ? preset.dockviewSnapshot : null
}))
    ↓
DockviewLayout effect fires → api.fromJSON(preset.dockviewSnapshot || getLayout(preset.layout))
    ↓
Exact panel arrangement is restored (v3) or predefined layout is used (v2)
```

v3 presets capture the **current** Dockview state at save-time, preserving custom drag arrangements, split proportions, and panel positions.

## Share Links

Share links encode a snapshot of the **Redux** state plus the **Dockview** visual state (v3 only):

**v3 Format** (current):

```
?v=3.0&date=2024-03-15&gmt=14:30:00&s=1&dv={compressed_layout}&f1=0101&f2=0100...
  │       │               │           │   │                      └─ per-frame pane type + state
  │       │               │           │   └─ compressed SerializedDockview JSON
  │       │               │           └─ source short code
  │       │               └─ time (HH:MM:SS)
  │       └─ date (YYYY-MM-DD)
  └─ share link version
```

**v2 Format** (legacy):

```
?v=2.0&date=2024-03-15&gmt=14:30:00&s=1&l=j&f1=0101&f2=0100...
  │       │               │           │   │   └─ per-frame pane type + state
  │       │               │           │   └─ layout letter
  │       │               │           └─ source short code
  │       │               └─ time (HH:MM:SS)
  │       └─ date (YYYY-MM-DD)
  └─ share link version
```

**v3 Generation** (from `generateShareURL()`):

```
const dockviewApi = getDockviewApi();
if (dockviewApi) {
  const serialized = dockviewApi.toJSON();
  const compressedLayout = compressDockviewSnapshot(serialized);  // LZUTF8 compression
  URL += `&v=3.0&dv=${encodeURIComponent(compressedLayout)}`;
} else {
  // Fallback to v2 if API unavailable
  URL += `&v=2.0&l=${framework.layout}`;
}
URL += stateUrlParams;  // &f1=... &f2=... etc.
```

When a v3 link is loaded:

- The `dv` parameter is decompressed into a `SerializedDockview` object
- Redux stores it in `framework.dockviewSnapshot`
- `DockviewLayout` component calls `api.fromJSON(dockviewSnapshot)` to restore the exact visual state
- Pane types and state are restored from `f1`, `f2`, ... parameters as usual

**v3 benefits**: Recipients get the exact layout the sharer saw — custom panel arrangements, split proportions, and group structure are preserved. Any drag rearrangements from the original session are included.

## The `dockviewSnapshot` Field

The `dockviewSnapshot` field in Redux stores a **point-in-time capture** of Dockview's layout state for initialization purposes. It is not a live mirror of the current layout — instead, it acts as a **loading hint** that tells Dockview what arrangement to restore when the component mounts.

### How it works

**Capture**: When the app generates a share link or saves a preset, it calls `api.toJSON()` to serialize Dockview's current state (panel positions, group structure, split proportions) into a `SerializedDockview` object. This snapshot is then:

- Compressed and stored in the URL's `dv` parameter (share links)
- Saved to the preset's `dockviewSnapshot` field (user presets)
- Written to Redux's `framework.dockviewSnapshot` when either is loaded

**Restore**: When the `DockviewLayout` component mounts or receives new state:

1. If `dockviewSnapshot` is set, Dockview calls `api.fromJSON(dockviewSnapshot)` to recreate the exact arrangement
2. If `dockviewSnapshot` is null, Dockview falls back to the layout letter system (predefined templates)

**Lifecycle**: Once loaded, `dockviewSnapshot` becomes **inert**. User interactions (dragging panels, resizing splits) update Dockview's internal state directly — Redux is not notified. The snapshot field remains unchanged until:

- The user saves a new preset (captures current state)
- The user generates a share link (captures current state)
- A new page/preset/share link is loaded (replaces snapshot)
