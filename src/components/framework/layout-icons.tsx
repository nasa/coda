/**
 * Inline SVG layout icons for each preset layout (a–s).
 *
 * Icons are generated dynamically from the Dockview layout tree definitions,
 * eliminating duplicate hardcoded layout specifications.
 * The component renders a lightweight inline SVG at the requested size.
 */
import { FunctionComponent, useMemo } from "react";
import { getLayoutIconDef } from "./dockview-layout-definitions";

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
 * Dynamically computes the icon from the Dockview layout tree definition,
 * ensuring the icon always matches the actual layout structure.
 *
 * @param layout  Layout key (a–s) matching `allLayoutLetters` in dockview-layouts
 * @param size    "small" (header bar) or "large" (layout picker modal)
 */
export const LayoutIcon: FunctionComponent<{
  layout: string;
  size: IconSize;
  className?: string;
}> = ({ layout, size, className }) => {
  const def = useMemo(() => {
    try {
      return getLayoutIconDef(layout);
    } catch {
      return null;
    }
  }, [layout]);

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
