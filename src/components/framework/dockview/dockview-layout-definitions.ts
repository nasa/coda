/**
 * Frozen legacy grid layouts (a–s).
 *
 * Each layout is expressed using the compact builder functions from
 * dockview-layout-builder.ts and exposes three public functions consumed
 * by the rest of the app:
 *   - getLayout         → SerializedDockview for api.fromJSON()
 *   - getLayoutIconDef  → rects for SVG icon rendering
 *   - getFrameCount     → number of panels in a layout
 *
 * These 19 layouts are frozen — new layouts should be authored directly as
 * Dockview snapshots rather than extending this file.
 */

import type { SerializedDockview } from "dockview-react";
import {
  type LayoutRect,
  type TreeNode,
  computeLayoutRects,
  hsplit,
  p,
  treeToSerialized,
  vsplit,
} from "./dockview-layout-builder";

// ---------------------------------------------------------------------------
// Layout definitions (a–s)
//
// Each layout is an IIFE that builds named intermediate pieces bottom-up,
// then returns the final assembly. Read from top to bottom: small pieces
// first, combined last.
//
// Builder reference:
//   p(n)                 — panel n (1-based)
//   hsplit([A,w],[B,w])  — A | B side by side,  w = relative width
//   vsplit([A,h],[B,h])  — A over B stacked,    h = relative height
//
// Proportional sizes derived from the original CSS grid (24 cols × 9 rows).
// ---------------------------------------------------------------------------

// Layout a — 5 frames: two top-left, bottom-left, two right stacked
const treeA = (() => {
  const topLeft = hsplit([p(1), 500], [p(2), 500]); // frames 1 | 2
  const leftCol = vsplit([topLeft, 560], [p(5), 440]); // top pair over frame 5
  const rightCol = vsplit([p(3), 440], [p(4), 560]); // frame 3 over frame 4
  return hsplit([leftCol, 750], [rightCol, 250]); // 75% left | 25% right
})();

// Layout b — 6 frames: two top-left, bottom-left, three right stacked
const treeB = (() => {
  const topLeft = hsplit([p(1), 500], [p(2), 500]); // frames 1 | 2
  const leftCol = vsplit([topLeft, 560], [p(5), 440]); // top pair over frame 5
  const rightCol = vsplit([p(3), 333], [p(4), 333], [p(6), 334]); // frames 3, 4, 6
  return hsplit([leftCol, 750], [rightCol, 250]); // 75% left | 25% right
})();

// Layout c — 5 frames: three top equal, bottom split 75/25
const treeC = (() => {
  const topRow = hsplit([p(1), 333], [p(2), 333], [p(3), 334]); // frames 1 | 2 | 3
  const bottomRow = hsplit([p(5), 750], [p(4), 250]); // frame 5 (75%) | frame 4 (25%)
  return vsplit([topRow, 560], [bottomRow, 440]);
})();

// Layout d — 4 frames: tall right frame, two top-left, one bottom-left
const treeD = (() => {
  const topLeft = hsplit([p(1), 500], [p(2), 500]); // frames 1 | 2
  const leftCol = vsplit([topLeft, 560], [p(4), 440]); // top pair over frame 4
  return hsplit([leftCol, 750], [p(3), 250]); // left col (75%) | tall frame 3 (25%)
})();

// Layout e — 4 frames: three top equal, one bottom full width
const treeE = (() => {
  const topRow = hsplit([p(1), 333], [p(2), 333], [p(3), 334]); // frames 1 | 2 | 3
  return vsplit([topRow, 560], [p(4), 440]);
})();

// Layout f — 9 frames: 3×3 grid
const treeF = (() => {
  const row1 = hsplit([p(1), 333], [p(2), 333], [p(3), 334]);
  const row2 = hsplit([p(4), 333], [p(5), 333], [p(6), 334]);
  const row3 = hsplit([p(7), 333], [p(8), 333], [p(9), 334]);
  return vsplit([row1, 333], [row2, 333], [row3, 334]);
})();

// Layout g — 6 frames: 2×3 grid (uses 10 rows for icon rendering)
const treeG = (() => {
  const topRow = hsplit([p(1), 333], [p(2), 333], [p(3), 334]);
  const bottomRow = hsplit([p(4), 333], [p(5), 333], [p(6), 334]);
  return vsplit([topRow, 500], [bottomRow, 500]);
})();

// Layout h — 1 frame: full screen
const treeH = p(1);

// Layout i — 3 frames: three rows stacked
const treeI = vsplit([p(1), 333], [p(2), 333], [p(3), 334]);

// Layout j — 6 frames: three top, bottom 50/25/25
const treeJ = (() => {
  const topRow = hsplit([p(1), 333], [p(2), 333], [p(3), 334]);
  const bottomRow = hsplit([p(5), 500], [p(6), 250], [p(4), 250]);
  return vsplit([topRow, 560], [bottomRow, 440]);
})();

// Layout k — 5 frames: three top, bottom split 50/50
const treeK = (() => {
  const topRow = hsplit([p(1), 333], [p(2), 333], [p(3), 334]);
  const bottomRow = hsplit([p(5), 500], [p(4), 500]);
  return vsplit([topRow, 560], [bottomRow, 440]);
})();

// Layout l — 6 frames: left column three stacked, top-right split, big bottom-right
const treeL = (() => {
  const leftCol = vsplit([p(1), 333], [p(5), 333], [p(6), 334]); // frames 1, 5, 6 stacked
  const topRight = hsplit([p(2), 500], [p(3), 500]); // frames 2 | 3
  const rightCol = vsplit([topRight, 333], [p(4), 667]); // top pair over big frame 4
  return hsplit([leftCol, 333], [rightCol, 667]); // 33% left | 67% right
})();

// Layout m — 4 frames: big left, three right stacked
const treeM = (() => {
  const rightCol = vsplit([p(2), 333], [p(3), 333], [p(4), 334]); // frames 2, 3, 4 stacked
  return hsplit([p(1), 710], [rightCol, 290]); // big frame 1 (71%) | right col (29%)
})();

// Layout n — 7 frames: three top, four bottom
const treeN = (() => {
  const topRow = hsplit([p(1), 333], [p(2), 333], [p(3), 334]);
  const bottomRow = hsplit([p(5), 250], [p(6), 250], [p(7), 250], [p(4), 250]);
  return vsplit([topRow, 560], [bottomRow, 440]);
})();

// Layout o — 2 frames: side by side
const treeO = hsplit([p(1), 500], [p(2), 500]);

// Layout p — 3 frames: two top, one bottom full width
const treeP = (() => {
  const topRow = hsplit([p(1), 500], [p(2), 500]);
  return vsplit([topRow, 670], [p(3), 330]);
})();

// Layout q — 4 frames: 2×2 grid
const treeQ = (() => {
  const topRow = hsplit([p(1), 500], [p(2), 500]);
  const bottomRow = hsplit([p(3), 500], [p(4), 500]);
  return vsplit([topRow, 670], [bottomRow, 330]);
})();

// Layout r — 5 frames: two top, three bottom
const treeR = (() => {
  const topRow = hsplit([p(1), 500], [p(2), 500]);
  const bottomRow = hsplit([p(3), 333], [p(4), 333], [p(5), 334]);
  return vsplit([topRow, 670], [bottomRow, 330]);
})();

// Layout s — 6 frames: two top, four bottom
const treeS = (() => {
  const topRow = hsplit([p(1), 500], [p(2), 500]);
  const bottomRow = hsplit([p(3), 250], [p(4), 250], [p(5), 250], [p(6), 250]);
  return vsplit([topRow, 670], [bottomRow, 330]);
})();

const layouts: Record<string, { frames: number; tree: TreeNode; visible: boolean }> = {
  a: { frames: 5, tree: treeA, visible: true },
  b: { frames: 6, tree: treeB, visible: false },
  c: { frames: 5, tree: treeC, visible: false },
  d: { frames: 4, tree: treeD, visible: false },
  e: { frames: 4, tree: treeE, visible: false },
  f: { frames: 9, tree: treeF, visible: true },
  g: { frames: 6, tree: treeG, visible: true },
  h: { frames: 1, tree: treeH, visible: true },
  i: { frames: 3, tree: treeI, visible: true },
  j: { frames: 6, tree: treeJ, visible: false },
  k: { frames: 5, tree: treeK, visible: false },
  l: { frames: 6, tree: treeL, visible: false },
  m: { frames: 4, tree: treeM, visible: true },
  n: { frames: 7, tree: treeN, visible: true },
  o: { frames: 2, tree: treeO, visible: false },
  p: { frames: 3, tree: treeP, visible: false },
  q: { frames: 4, tree: treeQ, visible: false },
  r: { frames: 5, tree: treeR, visible: true },
  s: { frames: 6, tree: treeS, visible: false },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ordered list of ALL layout letters (a–s).
 * Order must never change — shared links reference layouts by letter.
 */
export const allLayoutLetters = [
  "a",
  "b",
  "c",
  "j",
  "n",
  "k",
  "e",
  "d",
  "f",
  "g",
  "l",
  "m",
  "h",
  "i",
  "o",
  "p",
  "q",
  "r",
  "s",
] as const;

/** Union of all valid layout letter keys (a–s). */
export type LayoutLetter = (typeof allLayoutLetters)[number];

/**
 * Alphabetically sorted list of layouts that should appear in the layout picker dropdown.
 * Layouts with `visible: false` are excluded.
 */
export const visibleLayoutLetters: LayoutLetter[] = Object.keys(layouts)
  .filter((letter) => layouts[letter].visible)
  .sort() as LayoutLetter[];

/** Returns the SerializedDockview snapshot for a layout letter, for use with `api.fromJSON()`. */
export function getLayout(letter: LayoutLetter): SerializedDockview {
  const layout = layouts[letter];
  if (!layout) throw new Error(`Unknown layout: ${letter}`);
  return treeToSerialized(layout.tree);
}

/**
 * Returns the icon definition (rects + row count) for a layout letter.
 * Layout 'g' uses 10 rows for a more balanced 2×3 grid; all others use 9.
 */
export function getLayoutIconDef(letter: LayoutLetter): { rows: number; rects: LayoutRect[] } {
  const layout = layouts[letter];
  if (!layout) throw new Error(`Unknown layout: ${letter}`);
  const rows = letter === "g" ? 10 : 9;
  return { rows, rects: computeLayoutRects(layout.tree, 24, rows) };
}

/** Returns the number of panels in a layout, or 0 if the letter is unknown. */
export function getFrameCount(letter: LayoutLetter): number {
  return layouts[letter]?.frames ?? 0;
}
