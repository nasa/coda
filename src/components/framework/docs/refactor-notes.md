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
- Share links encode the preset layout letter + per-frame pane state.
- Custom drag rearrangements are not encoded.

## Store (`store/framework.ts`)

### Key exports

- `allLayoutLetters` — ordered list of preset letters (now in `dockview-presets.ts`)
- `allPanes` — pane type → `{ title, shortTitle, icon, color, defaultPaneStateData }`
- Reducers: `changeLayout`, `setPaneType`, `setAllFrameworkState`, `setPaneStateDataValue`, `addFrame`, `removeFrame`, `changeSource`

### Frame dimensions

- Sourced from Dockview panel API (`width`/`height` + `onDidDimensionsChange`), not ResizeObserver.

## Known Issues / TODO

- Dockview drag rearrangements are ephemeral (not persisted in share links). A v3.0 share link format could serialize Dockview layout state if needed.
- Dynamically added panels (via "+") are not persisted across layout changes — switching presets resets to the preset's frame count.
- Individual pane control components (comm, video-controls, etc.) retain their own internal CSS for dropdowns/buttons. These could be further unified to use `--nearly-black` backgrounds if desired.
