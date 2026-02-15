/**
 * Inline SVG layout icons for each preset layout (a–s).
 *
 * Each layout is defined as a set of rectangles on a 24-column × N-row grid,
 * matching the legacy CSS grid-template-areas that were used before Dockview.
 * The component renders a lightweight inline SVG at the requested size.
 */
import { FunctionComponent } from "react";

/** [x, y, width, height] on the 24×rows grid */
type Rect = readonly [number, number, number, number];

interface LayoutIconDef {
  readonly rows: number;
  readonly rects: readonly Rect[];
}

const layouts: Record<string, LayoutIconDef> = {
  a: {
    rows: 9,
    rects: [
      [0, 0, 9, 5],
      [9, 0, 9, 5],
      [18, 0, 6, 4],
      [18, 4, 6, 5],
      [0, 5, 18, 4],
    ],
  },
  b: {
    rows: 9,
    rects: [
      [0, 0, 9, 5],
      [9, 0, 9, 5],
      [18, 0, 6, 3],
      [18, 3, 6, 3],
      [0, 5, 18, 4],
      [18, 6, 6, 3],
    ],
  },
  c: {
    rows: 9,
    rects: [
      [0, 0, 8, 5],
      [8, 0, 8, 5],
      [16, 0, 8, 5],
      [18, 5, 6, 4],
      [0, 5, 18, 4],
    ],
  },
  d: {
    rows: 9,
    rects: [
      [0, 0, 9, 5],
      [9, 0, 9, 5],
      [18, 0, 6, 9],
      [0, 5, 18, 4],
    ],
  },
  e: {
    rows: 9,
    rects: [
      [0, 0, 8, 5],
      [8, 0, 8, 5],
      [16, 0, 8, 5],
      [0, 5, 24, 4],
    ],
  },
  f: {
    rows: 9,
    rects: [
      [0, 0, 8, 3],
      [8, 0, 8, 3],
      [16, 0, 8, 3],
      [0, 3, 8, 3],
      [8, 3, 8, 3],
      [16, 3, 8, 3],
      [0, 6, 8, 3],
      [8, 6, 8, 3],
      [16, 6, 8, 3],
    ],
  },
  g: {
    rows: 10,
    rects: [
      [0, 0, 8, 5],
      [8, 0, 8, 5],
      [16, 0, 8, 5],
      [0, 5, 8, 5],
      [8, 5, 8, 5],
      [16, 5, 8, 5],
    ],
  },
  h: { rows: 9, rects: [[0, 0, 24, 9]] },
  i: {
    rows: 9,
    rects: [
      [0, 0, 24, 3],
      [0, 3, 24, 3],
      [0, 6, 24, 3],
    ],
  },
  j: {
    rows: 9,
    rects: [
      [0, 0, 8, 5],
      [8, 0, 8, 5],
      [16, 0, 8, 5],
      [0, 5, 12, 4],
      [12, 5, 6, 4],
      [18, 5, 6, 4],
    ],
  },
  k: {
    rows: 9,
    rects: [
      [0, 0, 8, 5],
      [8, 0, 8, 5],
      [16, 0, 8, 5],
      [0, 5, 12, 4],
      [12, 5, 12, 4],
    ],
  },
  l: {
    rows: 9,
    rects: [
      [0, 0, 8, 3],
      [8, 0, 8, 3],
      [16, 0, 8, 3],
      [0, 3, 8, 3],
      [0, 6, 8, 3],
      [8, 3, 16, 6],
    ],
  },
  m: {
    rows: 9,
    rects: [
      [0, 0, 17, 9],
      [17, 0, 7, 3],
      [17, 3, 7, 3],
      [17, 6, 7, 3],
    ],
  },
  n: {
    rows: 9,
    rects: [
      [0, 0, 8, 5],
      [8, 0, 8, 5],
      [16, 0, 8, 5],
      [0, 5, 6, 4],
      [6, 5, 6, 4],
      [12, 5, 6, 4],
      [18, 5, 6, 4],
    ],
  },
  o: {
    rows: 9,
    rects: [
      [0, 0, 12, 9],
      [12, 0, 12, 9],
    ],
  },
  p: {
    rows: 9,
    rects: [
      [0, 0, 12, 6],
      [12, 0, 12, 6],
      [0, 6, 24, 3],
    ],
  },
  q: {
    rows: 9,
    rects: [
      [0, 0, 12, 6],
      [12, 0, 12, 6],
      [0, 6, 12, 3],
      [12, 6, 12, 3],
    ],
  },
  r: {
    rows: 9,
    rects: [
      [0, 0, 12, 6],
      [12, 0, 12, 6],
      [0, 6, 8, 3],
      [8, 6, 8, 3],
      [16, 6, 8, 3],
    ],
  },
  s: {
    rows: 9,
    rects: [
      [0, 0, 12, 6],
      [12, 0, 12, 6],
      [0, 6, 6, 3],
      [6, 6, 6, 3],
      [12, 6, 6, 3],
      [18, 6, 6, 3],
    ],
  },
};

/** Gap between rectangles in grid-coordinate units */
const GAP = 0.4;
/** Corner radius in grid-coordinate units */
const RX = 0.4;

const SIZES = {
  /** Small icon used in the header bar layout button */
  small: { width: 29, height: 16 },
  /** Large icon used in the layout picker modal */
  large: { width: 100, height: 36 },
} as const;

type IconSize = keyof typeof SIZES;

/**
 * Renders an inline SVG depicting the given layout.
 *
 * @param layout  Layout key (a–s) matching `allLayoutLetters` in dockview-layouts
 * @param size    "small" (header bar) or "large" (layout picker modal)
 */
export const LayoutIcon: FunctionComponent<{
  layout: string;
  size: IconSize;
  className?: string;
}> = ({ layout, size, className }) => {
  const def = layouts[layout];
  if (!def) return null;

  const { width, height } = SIZES[size];
  const cols = 24;
  const { rows, rects } = def;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${cols} ${rows}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Layout ${layout}`}
    >
      {rects.map(([x, y, w, h], idx) => (
        <rect
          key={idx}
          x={x + GAP / 2}
          y={y + GAP / 2}
          width={w - GAP}
          height={h - GAP}
          rx={RX}
          fill="white"
        />
      ))}
    </svg>
  );
};
