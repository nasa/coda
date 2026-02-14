# Dockview Refactor Notes

Current-state reference for the Dockview-based layout system.

## Architecture

### Layout system

- **Dockview** (`dockview-react` 4.13.1) manages the visual panel layout.
- **Redux** (`framework` slice) manages what pane type is displayed in each panel, plus the active preset letter.
- 19 preset layouts (letters a–s) are defined in `dockview-presets.ts` as Dockview serialized JSON trees, loaded via `api.fromJSON()`.
- Changing the layout letter in Redux triggers a `fromJSON` reload in `dockview-layout.tsx`.
- Dockview drag rearrangements are ephemeral — not persisted in share links.

### Preset layouts (`allLayoutLetters` in `dockview-presets.ts`)

- Ordered array of layout preset letters (a–s) for the layout picker dropdown.
- Layout structure (tree of splits/panels) is defined in `presetTrees` within the same file.
- Letters must never change (shared links reference them).
- Array order determines dropdown display order (not alphabetical).
- The old `allLayouts` object (with `frameCount` per letter) has been removed from `store/framework.ts` — frame count is intrinsic to the Dockview preset tree definition.

### Layout icons (`layout-icons.tsx`)

- Each preset is defined as a set of rectangle coordinates on a 24×N grid.
- Rendered as lightweight inline SVGs at two sizes: `small` (29×16, header bar) and `large` (100×56, layout picker modal).
- No CSS grid dependencies — all layout visualization is self-contained in this file.

### Panel/tab components

| File                                 | Purpose                                                           |
| ------------------------------------ | ----------------------------------------------------------------- |
| `dockview-layout.tsx`                | Main `DockviewReact` container, theme overrides, watermark        |
| `dockview-layout.module.css`         | Container height, Dockview CSS variable overrides                 |
| `dockview-pane-panel.tsx`            | Panel content: renders pane body or empty-state watermark picker  |
| `dockview-pane-panel.module.css`     | Watermark pane picker grid styles                                 |
| `dockview-tab.tsx`                   | Custom tab: icon + short title + chevron for pane picker dropdown |
| `dockview-tab.module.css`            | Tab, chevron, close button styles                                 |
| `dockview-header-actions.tsx`        | Right header "+" button + inline/collapsed pane controls          |
| `dockview-header-actions.module.css` | Add button + collapsed controls popover styles                    |
| `dockview-presets.ts`                | Tree DSL + all 19 serialized Dockview layouts                     |
| `layout-icons.tsx`                   | Inline SVG layout icons for picker and header                     |

**Visual customizations:**

- Tab height reduced to 26px (via `--dv-tab-height`) to match control component heights
- Grip icon (`faGripVertical`) added to the left of each tab for visual affordance

### Tab row controls

- Pane-specific controls render in the right header actions area (next to the "+" button).
- When available width < 200px, controls collapse into a popover behind a sliders-icon button.
- Popover passes fake `frameDimensions` of `[800, 600]` so controls render expanded.
- `.dv-void-container { flex-grow: 0 }` and `.dv-right-actions-container { flex: 1 }` fix positioning.

### Pane picker

- `pane-picker.tsx` / `pane-picker.module.css` — dropdown list of available pane types.
- "empty" type is filtered out of the dropdown (new panels start empty, close removes them).
- "Close Panel" option at bottom of dropdown (styled with `closeOption`/`closeLabel` classes).
- Styled with `--nearly-black` background, 12px font, colored icon text.

### Share links

- v1.0 and v2.0 share links decode via `interpretFramestateQueryString` unchanged.
- v2.0 share links encode the preset layout letter (`&l=`) + per-frame pane state.
- **v3.0 share links** capture the live Dockview layout via `api.toJSON()`, compressed with LZUTF8 and encoded as Base64 in the `&dv=` query parameter.
  - Preserves exact panel splits, proportions, and arrangement — even after drag rearrangements.
  - Proportionality is maintained across different screen resolutions (Dockview's `fromJSON()` scales sizes proportionally to the container).
  - The layout letter (`&l=`) is omitted in v3; the `dv` param is the sole source of layout truth.
  - Per-frame pane state (`f1`, `f2`, …) is encoded identically to v2.
  - New share links default to v3 when the DockviewApi is available; fallback to v2 otherwise.
- Custom drag rearrangements are now persisted in v3 share links.

#### v3 URL format

```
?date=YYYY-MM-DD&gmt=HH:MM:SS&v=3.0&s=<source>&dv=<LZUTF8+Base64 SerializedDockview>&f1=...&f2=...
```

#### Key files for v3

| File                   | Role                                                          |
| ---------------------- | ------------------------------------------------------------- |
| `dockview-api-ref.ts`  | Module-level getter/setter for the `DockviewApi` instance     |
| `share-state.ts`       | `compressDockviewLayout` / `decompressDockviewLayout` helpers |
| `pages/view/index.tsx` | Parses `dv` param in v3 URLs, sets `dockviewLayout` on state  |
| `dockview-layout.tsx`  | Uses `dockviewLayout` from Redux if present; exposes API ref  |

### Presets

- User presets saved to cookies now include a `version` field (`2` or `3`).
- v3 presets capture the serialized Dockview layout (`dockviewLayout` field) via `api.toJSON()` at save time.
- v2 presets (without `version` field) are loaded using the legacy layout-letter system.
- System presets in `framework-presets.ts` remain letter-based (v2).
- When selecting a v3 preset, `dockviewLayout` is set on `FrameworkState`, and `DockviewLayout` applies it directly via `api.fromJSON()`.

## Store (`store/framework.ts`)

### Key exports

- `allLayoutLetters` — ordered list of preset letters (now in `dockview-presets.ts`)
- `allPanes` — pane type → `{ title, shortTitle, icon, color, defaultPaneStateData }`
- Reducers: `changeLayout`, `setPaneType`, `setAllFrameworkState`, `setPaneStateDataValue`, `addFrame`, `removeFrame`
- `changeLayout` now accepts `{ layout, frameCount }` and trims `state.frames` to 1–frameCount
- `changeSource` has been removed (was dead code — never dispatched)
- `FrameworkState.dockviewLayout` — optional `SerializedDockview | null`; when set, `DockviewLayout` uses it instead of the preset letter

### Frame dimensions

- Sourced from Dockview panel API (`width`/`height` + `onDidDimensionsChange`), not ResizeObserver.

## Known Issues / TODO

- Individual pane control components (comm, video-controls, etc.) retain their own internal CSS for dropdowns/buttons. These could be further unified to use `--nearly-black` backgrounds if desired.
