/**
 * Dockview preset layout definitions.
 *
 * Each of the 19 CSS grid presets (a–s) is represented as a tree of splits
 * and panels, then converted to the SerializedDockview format consumed by
 * `api.fromJSON()`.
 *
 * The tree builder uses explicit directions — `hsplit` (left-to-right) and
 * `vsplit` (top-to-bottom) — which must alternate at each nesting level
 * to match Dockview's grid model.
 */

import type { SerializedDockview } from "dockview-react";
import { Orientation } from "dockview-react";

// ---------------------------------------------------------------------------
// Tree DSL types
// ---------------------------------------------------------------------------

interface PanelNode {
  kind: "panel";
  frameId: number;
}

interface SplitNode {
  kind: "split";
  direction: "h" | "v";
  children: { node: TreeNode; size: number }[];
}

type TreeNode = PanelNode | SplitNode;

// ---------------------------------------------------------------------------
// Helpers to build the tree
// ---------------------------------------------------------------------------

function p(frameId: number): PanelNode {
  return { kind: "panel", frameId };
}

function hsplit(...args: [TreeNode, number][]): SplitNode {
  return {
    kind: "split",
    direction: "h",
    children: args.map(([node, size]) => ({ node, size })),
  };
}

function vsplit(...args: [TreeNode, number][]): SplitNode {
  return {
    kind: "split",
    direction: "v",
    children: args.map(([node, size]) => ({ node, size })),
  };
}

// ---------------------------------------------------------------------------
// Convert tree → SerializedDockview
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

function treeToSerialized(root: TreeNode): SerializedDockview {
  const panels: Record<
    string,
    {
      id: string;
      contentComponent: string;
      tabComponent: string;
      params: { frameId: number };
      title: string;
    }
  > = {};
  let groupCounter = 0;

  function convert(node: TreeNode, size: number): GridNode {
    if (node.kind === "panel") {
      groupCounter++;
      const groupId = `g-${groupCounter}`;
      const panelId = `frame-${node.frameId}`;
      panels[panelId] = {
        id: panelId,
        contentComponent: "pane",
        tabComponent: "paneTab",
        params: { frameId: node.frameId },
        title: `Frame ${node.frameId}`,
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

  // Single panel edge case
  if (root.kind === "panel") {
    groupCounter++;
    const groupId = `g-${groupCounter}`;
    const panelId = `frame-${root.frameId}`;
    panels[panelId] = {
      id: panelId,
      contentComponent: "pane",
      tabComponent: "paneTab",
      params: { frameId: root.frameId },
      title: `Frame ${root.frameId}`,
    };
    return {
      grid: {
        root: {
          type: "leaf",
          data: { id: groupId, views: [panelId], activeView: panelId },
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
// Preset definitions (a–s)
//
// Proportional sizes derived from the CSS grid (24 cols × 9 or 10 rows).
// ---------------------------------------------------------------------------

const presetTrees: Record<string, TreeNode> = {
  // Layout h: 1 frame — full screen
  h: p(1),

  // Layout o: 2 frames — side by side
  o: hsplit([p(1), 500], [p(2), 500]),

  // Layout i: 3 frames — three rows stacked
  i: vsplit([p(1), 333], [p(2), 333], [p(3), 334]),

  // Layout p: 3 frames — two top, one bottom full width
  p: vsplit([hsplit([p(1), 500], [p(2), 500]), 670], [p(3), 330]),

  // Layout e: 4 frames — three top equal, one bottom full width
  e: vsplit([hsplit([p(1), 333], [p(2), 333], [p(3), 334]), 560], [p(4), 440]),

  // Layout d: 4 frames — tall right column, two top-left, one bottom-left
  d: hsplit([vsplit([hsplit([p(1), 500], [p(2), 500]), 560], [p(4), 440]), 750], [p(3), 250]),

  // Layout m: 4 frames — big left, three right stacked
  m: hsplit([p(1), 710], [vsplit([p(2), 333], [p(3), 333], [p(4), 334]), 290]),

  // Layout q: 4 frames — 2×2 grid
  q: vsplit([hsplit([p(1), 500], [p(2), 500]), 670], [hsplit([p(3), 500], [p(4), 500]), 330]),

  // Layout a: 5 frames — two top-left, bottom-left, two right stacked
  a: hsplit(
    [vsplit([hsplit([p(1), 500], [p(2), 500]), 560], [p(5), 440]), 750],
    [vsplit([p(3), 440], [p(4), 560]), 250]
  ),

  // Layout c: 5 frames — three top equal, bottom split 75/25
  c: vsplit(
    [hsplit([p(1), 333], [p(2), 333], [p(3), 334]), 560],
    [hsplit([p(5), 750], [p(4), 250]), 440]
  ),

  // Layout k: 5 frames — three top, bottom split 50/50
  k: vsplit(
    [hsplit([p(1), 333], [p(2), 333], [p(3), 334]), 560],
    [hsplit([p(5), 500], [p(4), 500]), 440]
  ),

  // Layout r: 5 frames — two top, three bottom
  r: vsplit(
    [hsplit([p(1), 500], [p(2), 500]), 670],
    [hsplit([p(3), 333], [p(4), 333], [p(5), 334]), 330]
  ),

  // Layout b: 6 frames — two top-left, bottom-left, three right stacked
  b: hsplit(
    [vsplit([hsplit([p(1), 500], [p(2), 500]), 560], [p(5), 440]), 750],
    [vsplit([p(3), 333], [p(4), 333], [p(6), 334]), 250]
  ),

  // Layout j: 6 frames — three top, bottom 50/25/25
  j: vsplit(
    [hsplit([p(1), 333], [p(2), 333], [p(3), 334]), 560],
    [hsplit([p(5), 500], [p(6), 250], [p(4), 250]), 440]
  ),

  // Layout l: 6 frames — left column three stacked, top-right two, big bottom-right
  l: hsplit(
    [vsplit([p(1), 333], [p(5), 333], [p(6), 334]), 333],
    [vsplit([hsplit([p(2), 500], [p(3), 500]), 333], [p(4), 667]), 667]
  ),

  // Layout g: 6 frames — 2×3 grid (10 rows, 50/50 split)
  g: vsplit(
    [hsplit([p(1), 333], [p(2), 333], [p(3), 334]), 500],
    [hsplit([p(4), 333], [p(5), 333], [p(6), 334]), 500]
  ),

  // Layout s: 6 frames — two top, four bottom
  s: vsplit(
    [hsplit([p(1), 500], [p(2), 500]), 670],
    [hsplit([p(3), 250], [p(4), 250], [p(5), 250], [p(6), 250]), 330]
  ),

  // Layout n: 7 frames — three top, four bottom
  n: vsplit(
    [hsplit([p(1), 333], [p(2), 333], [p(3), 334]), 560],
    [hsplit([p(5), 250], [p(6), 250], [p(7), 250], [p(4), 250]), 440]
  ),

  // Layout f: 9 frames — 3×3 grid
  f: vsplit(
    [hsplit([p(1), 333], [p(2), 333], [p(3), 334]), 333],
    [hsplit([p(4), 333], [p(5), 333], [p(6), 334]), 333],
    [hsplit([p(7), 333], [p(8), 333], [p(9), 334]), 334]
  ),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getPresetLayout(letter: string): SerializedDockview {
  const tree = presetTrees[letter];
  if (!tree) {
    throw new Error(`Unknown layout preset: ${letter}`);
  }
  return treeToSerialized(tree);
}
