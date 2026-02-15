# Redux ↔ Dockview Architecture

How the Redux `framework` slice and the Dockview panel renderer work together.

## Ownership Boundaries

The system has a clean separation of concerns between two state managers:

| Concern                                                             | Owner                     | Location               |
| ------------------------------------------------------------------- | ------------------------- | ---------------------- |
| **What** is displayed in each panel (pane type + pane settings)     | Redux (`framework` slice) | `store/framework.ts`   |
| **Where** panels are positioned (grid structure, sizes, drag state) | Dockview (`DockviewApi`)  | `dockview-layout.tsx`  |
| **Which** layouts exist (tree definitions, letter order)            | Dockview layouts          | `dockview-layouts.ts`  |
| **Encoding/decoding** state for share links                         | Share utilities           | `utils/share-state.ts` |

Redux never knows about panel positions or group splits. Dockview never knows about video channels, map lock toggles, or filter states. The bridge between them is the **`frameId`** — an integer identifier assigned to each panel at creation time and passed through Dockview's `params` mechanism.

## Data Flow

### 1. Initial Load / Share Link

```
URL query params
    ↓
view/index.tsx: getURLParams() parses ?l=j&f1=0101&f2=0100...
    ↓
dispatch(setAllFrameworkState({ layout: "j", frames: { 1: {...}, 2: {...} } }))
    ↓
Redux framework slice updates: layout="j", frames={...}
    ↓
DockviewLayout reads layout from Redux → getLayout("j") → api.fromJSON(layout)
    ↓
Dockview creates panels with params: { frameId: 1 }, { frameId: 2 }, ...
    ↓
Each panel's DockviewPanePanel reads state.framework.frames[frameId] to render the right pane
```

### 2. User Picks a New Layout

```
LayoutPicker dispatches changeLayout({ layout: "e", frameCount: 4 })
    ↓
Redux: layout="e", layoutLastChanged=Date.now()
  + frames trimmed to keys 1–4 (keys 5+ deleted)
    ↓
DockviewLayout effect fires → getLayout("e") → api.fromJSON(layout)
    ↓
Entire Dockview tree is replaced with the new layout's panel structure
    ↓
Panels 1–4 read their pane types from Redux frames (preserving existing selections)
Any panel added later via "+" gets a fresh empty frame → watermark picker
```

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
User drags a tab to a different group
    ↓
Dockview handles this entirely — groups, splits, sizes change
    ↓
Redux is NOT updated — the layout letter and frame state remain the same
    ↓
The panel keeps its frameId param, so it continues reading the correct Redux state
```

Drag rearrangements are **ephemeral**. Switching layouts or generating a share link uses the layout letter, not Dockview's current visual arrangement.

## The `frameId` Bridge

Every Dockview panel is created with a `params: { frameId: N }` object. This integer is the key that connects the two systems:

- **Dockview side**: `DockviewPanePanel` receives `params.frameId` from the Dockview API
- **Redux side**: `state.framework.frames[frameId]` holds the pane type and all pane-specific state
- **Pane components**: Receive `frameID` as a prop, use it to select their Redux state and dispatch state updates

The `frameId` is assigned by the layout definitions (frames 1–N for N-panel layouts) or dynamically when adding panels via the "+" button (max existing ID + 1).

## Layout Letter vs Redux Layout State

The `layout` field in the Redux `framework` slice is a **layout identifier**, not an active layout manager. It records which layout letter was last selected, and serves these purposes:

| Purpose                                              | Consumer              |
| ---------------------------------------------------- | --------------------- |
| Initialize Dockview panels via `getLayout(letter)`   | `dockview-layout.tsx` |
| Show the currently selected layout icon in the header | `header.tsx`          |
| Highlight the active layout in the layout picker         | `layout-picker.tsx`   |
| Encode into share link URLs (`&l=j`)                     | `share-state.ts`      |
| Store/restore with user presets (cookies)                | `preset-picker.tsx`   |

Once Dockview has loaded a layout, the layout letter has no further effect on rendering. Users can drag panels to completely rearrange the visual layout without the letter changing.

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

## Share Links

Share links encode a snapshot of the **Redux** state, not the Dockview visual state:

```
?v=2.0&l=j&s=1&f1=0101&f2=0100&f3=0300&f4=0401&f5=0510&f6=0600
  │       │   │   └─ per-frame pane type + pane state encoded
  │       │   └─ source short code
  │       └─ layout letter
  └─ share link version
```

On load, the layout letter initializes Dockview (creating the panel grid), and the frame state populates Redux (setting pane types and their settings). Any drag rearrangements from the original session are lost — the recipient gets a clean layout with the same pane assignments.

## Why Not Store Dockview State in Redux?

Dockview's internal state (group tree, split ratios, panel positions) is complex and volatile. Storing it in Redux would require:

1. Bidirectional sync — Dockview changes → Redux, Redux changes → Dockview
2. Serializing the full `api.toJSON()` output on every drag/resize
3. Diffing nested grid structures for selector performance
4. Potential infinite update loops between the two state managers

The current architecture avoids all of this. Redux is the source of truth for **content**, Dockview for **position**. They communicate through stable `frameId` references that survive drag operations.

If drag persistence is needed later (e.g., a v3.0 share link format), the right approach is to call `api.toJSON()` at share-time and encode the result, rather than keeping Dockview state live in Redux.
