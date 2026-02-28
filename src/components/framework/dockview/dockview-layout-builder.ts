/**
 * Layout builder for Dockview.
 *
 * Dockview's native serialization format (SerializedDockview) is verbose
 * nested JSON — readable by machines but not by humans. This file provides
 * three compact builder functions — `p`, `hsplit`, `vsplit` — that let each
 * legacy grid layout be expressed in a single readable line or short indented
 * block, then renders it to SerializedDockview via `treeToSerialized` for
 * consumption by `api.fromJSON()`.
 *
 * These layouts are frozen (a–s). New layouts should be authored directly as
 * Dockview snapshots rather than extending this file.
 */

import type { SerializedDockview } from "dockview-react";
import { Orientation } from "dockview-react";

// ---------------------------------------------------------------------------
// Tree node types
// ---------------------------------------------------------------------------

interface PanelNode {
  kind: "panel";
  paneInstanceId: number;
}

interface SplitNode {
  kind: "split";
  direction: "h" | "v";
  children: { node: TreeNode; size: number }[];
}

export type TreeNode = PanelNode | SplitNode;

/** [x, y, width, height] rectangle on the grid */
export type LayoutRect = readonly [number, number, number, number];

// ---------------------------------------------------------------------------
// Builder functions
// ---------------------------------------------------------------------------

/** Creates a leaf panel node for the given 1-based frame ID. */
export function p(paneInstanceId: number): PanelNode {
  return { kind: "panel", paneInstanceId };
}

/** Creates a horizontal (left-to-right) split node. Each arg is [node, proportional size]. */
export function hsplit(...args: [TreeNode, number][]): SplitNode {
  return {
    kind: "split",
    direction: "h",
    children: args.map(([node, size]) => ({ node, size })),
  };
}

/** Creates a vertical (top-to-bottom) split node. Each arg is [node, proportional size]. */
export function vsplit(...args: [TreeNode, number][]): SplitNode {
  return {
    kind: "split",
    direction: "v",
    children: args.map(([node, size]) => ({ node, size })),
  };
}

// ---------------------------------------------------------------------------
// DSL tree → SerializedDockview
// ---------------------------------------------------------------------------

interface GridLeaf {
  type: "leaf";
  data: { id: string; views: string[]; activeView: string };
  size: number;
}

interface GridBranch {
  type: "branch";
  data: GridNode[];
  size: number;
}

type GridNode = GridLeaf | GridBranch;

/** Converts a DSL tree into the SerializedDockview format consumed by `api.fromJSON()`. */
export function treeToSerialized(root: TreeNode): SerializedDockview {
  const panels: Record<
    string,
    {
      id: string;
      contentComponent: string;
      tabComponent: string;
      params: { paneInstanceId: number };
      title: string;
    }
  > = {};
  let groupCounter = 0;

  function convert(node: TreeNode, size: number): GridNode {
    if (node.kind === "panel") {
      groupCounter++;
      const groupId = `g-${groupCounter}`;
      const panelId = `paneInstance-${node.paneInstanceId}`;
      panels[panelId] = {
        id: panelId,
        contentComponent: "pane",
        tabComponent: "paneTab",
        params: { paneInstanceId: node.paneInstanceId },
        title: `Frame ${node.paneInstanceId}`,
      };
      return {
        type: "leaf",
        data: { id: groupId, views: [panelId], activeView: panelId },
        size,
      };
    }

    return {
      type: "branch",
      data: node.children.map((c) => convert(c.node, c.size)),
      size,
    };
  }

  // Single panel edge case — wrap in a branch to satisfy Dockview requirements
  if (root.kind === "panel") {
    groupCounter++;
    const groupId = `g-${groupCounter}`;
    const panelId = `paneInstance-${root.paneInstanceId}`;
    panels[panelId] = {
      id: panelId,
      contentComponent: "pane",
      tabComponent: "paneTab",
      params: { paneInstanceId: root.paneInstanceId },
      title: `Frame ${root.paneInstanceId}`,
    };
    return {
      grid: {
        root: {
          type: "branch",
          data: [
            {
              type: "leaf",
              data: { id: groupId, views: [panelId], activeView: panelId },
              size: 1000,
            },
          ],
          size: 1000,
        },
        height: 1000,
        width: 1000,
        orientation: Orientation.HORIZONTAL,
      },
      panels,
      activeGroup: groupId,
    };
  }

  const orientation = root.direction === "h" ? Orientation.HORIZONTAL : Orientation.VERTICAL;
  const gridRoot = convert(root, 1000);

  return {
    grid: {
      root: gridRoot as SerializedDockview["grid"]["root"],
      height: 1000,
      width: 1000,
      orientation,
    },
    panels,
    activeGroup: "g-1",
  };
}

// ---------------------------------------------------------------------------
// Icon rect computation
// ---------------------------------------------------------------------------

/**
/** Computes per-panel rectangles for SVG icon rendering by walking the layout
 * tree and distributing space proportionally at each split.
 *
 * @param tree  The DSL layout tree to compute rects for
 * @param cols  Grid width units (default 24)
 * @param rows  Grid height units (default 9)
 * @returns     Array of [x, y, width, height] indexed by paneInstanceId - 1
 */
export function computeLayoutRects(
  tree: TreeNode,
  cols: number = 24,
  rows: number = 9
): LayoutRect[] {
  const rects: LayoutRect[] = [];

  function walk(node: TreeNode, x: number, y: number, width: number, height: number): void {
    if (node.kind === "panel") {
      rects[node.paneInstanceId - 1] = [x, y, width, height];
      return;
    }

    const totalSize = node.children.reduce((sum, c) => sum + c.size, 0);
    let offset = 0;

    for (const child of node.children) {
      const proportion = child.size / totalSize;
      if (node.direction === "h") {
        const childWidth = width * proportion;
        walk(child.node, x + offset, y, childWidth, height);
        offset += childWidth;
      } else {
        const childHeight = height * proportion;
        walk(child.node, x, y + offset, width, childHeight);
        offset += childHeight;
      }
    }
  }

  walk(tree, 0, 0, cols, rows);
  return rects;
}
