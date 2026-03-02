/**
 * Layout builder and share-link DSL for Dockview.
 *
 * ## Builder (p / hsplit / vsplit → treeToSerialized)
 * Three compact builder functions let each preset layout be expressed in a
 * single readable line, then rendered to SerializedDockview for `api.fromJSON()`.
 * The letter-preset constants in dockview-layout-definitions.ts use these.
 *
 * ## Compact DSL string format (share links)
 * The tree structure of any layout — preset or custom — is encoded as a short
 * human-readable string used in v3 share URLs (`&dv=…`):
 *
 *   panel   →  "<id>"              e.g. "3"
 *   h-split →  "h(<child>:<size>,…)"  e.g. "h(1:500,2:500)"
 *   v-split →  "v(<child>:<size>,…)"  e.g. "v(h(1:333,2:667):560,3:440)"
 *
 * Functions:
 *   treeToString(node)         — TreeNode → DSL string
 *   stringToTree(s)            — DSL string → TreeNode | null
 *   serializedToTree(serialized) — SerializedDockview → TreeNode | null
 *                                (reverse-engineers live api.toJSON() output
 *                                 using alternating-orientation inference)
 *
 * Legacy letter presets (a–s) are frozen — new layouts should go through the
 * DSL functions above rather than adding more preset constants here.
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
// DSL string serialization  (TreeNode ↔ compact string for share URLs)
// ---------------------------------------------------------------------------

/**
 * Serializes a TreeNode to a compact DSL string suitable for use in share URLs.
 * Examples: "1", "h(1:500,2:500)", "v(h(1:333,2:333,3:334):560,h(5:750,4:250):440)"
 */
export function treeToString(root: TreeNode): string {
  if (root.kind === "panel") return String(root.paneInstanceId);

  interface Frame {
    node: SplitNode;
    childIdx: number;
    childStrs: string[];
  }

  const stack: Frame[] = [{ node: root, childIdx: 0, childStrs: [] }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    if (frame.childIdx < frame.node.children.length) {
      const child = frame.node.children[frame.childIdx];
      frame.childIdx++;

      if (child.node.kind === "panel") {
        frame.childStrs.push(String(child.node.paneInstanceId));
      } else {
        stack.push({ node: child.node, childIdx: 0, childStrs: [] });
      }
    } else {
      const parts = frame.node.children.map(
        (c, i) => `${frame.childStrs[i]}:${Math.round(c.size)}`
      );
      const result = `${frame.node.direction}(${parts.join(",")})`;
      stack.pop();

      if (stack.length > 0) {
        stack[stack.length - 1].childStrs.push(result);
      } else {
        return result;
      }
    }
  }

  return ""; // unreachable
}

/**
 * Parses a DSL string back into a TreeNode.
 * Returns null if the string is malformed or contains unexpected characters.
 */
export function stringToTree(input: string): TreeNode | null {
  const s = input.trim();
  let pos = 0;

  type PendingSplit = {
    direction: "h" | "v";
    children: { node: TreeNode; size: number }[];
  };

  const stack: PendingSplit[] = [];

  while (pos < s.length) {
    const ch = s[pos];

    if (/\d/.test(ch)) {
      // Panel: consume digits
      let num = "";
      while (pos < s.length && /\d/.test(s[pos])) num += s[pos++];
      const node: TreeNode = { kind: "panel", paneInstanceId: parseInt(num, 10) };

      if (stack.length === 0) return pos === s.length ? node : null;

      if (s[pos] !== ":") return null;
      pos++; // consume ":"
      let sizeStr = "";
      while (pos < s.length && /\d/.test(s[pos])) sizeStr += s[pos++];
      if (!sizeStr) return null;
      stack[stack.length - 1].children.push({ node, size: parseInt(sizeStr, 10) });
      if (s[pos] === ",") pos++; // consume optional ","
    } else if (ch === "h" || ch === "v") {
      pos++; // consume direction char
      if (s[pos] !== "(") return null;
      pos++; // consume "("
      stack.push({ direction: ch, children: [] });
    } else if (ch === ")") {
      pos++; // consume ")"
      if (stack.length === 0) return null;
      const pending = stack.pop()!;
      if (pending.children.length === 0) return null;
      const node: TreeNode = {
        kind: "split",
        direction: pending.direction,
        children: pending.children,
      };

      if (stack.length === 0) return pos === s.length ? node : null;

      if (s[pos] !== ":") return null;
      pos++; // consume ":"
      let sizeStr = "";
      while (pos < s.length && /\d/.test(s[pos])) sizeStr += s[pos++];
      if (!sizeStr) return null;
      stack[stack.length - 1].children.push({ node, size: parseInt(sizeStr, 10) });
      if (s[pos] === ",") pos++; // consume optional ","
    } else {
      return null; // unexpected character
    }
  }

  return null; // string ended without a complete top-level node
}

type RawNode = { type: "leaf" | "branch"; data: unknown; size: number };

interface WalkFrame {
  rawNode: RawNode;
  isHoriz: boolean;
  childIdx: number;
  childNodes: { node: TreeNode; size: number }[];
}

/**
 * Reconstructs a TreeNode from a live SerializedDockview layout (e.g. from
 * `dockviewApi.toJSON()`). Dockview's grid format does not tag each branch with
 * a direction; instead, the top-level `grid.orientation` is canonical and every
 * deeper nesting level alternates. This function uses that alternating rule to
 * recover h/v direction at each depth.
 *
 * Returns null only if the serialized layout is structurally malformed (missing root,
 * missing panel params, etc.). Valid live layouts from this app always succeed.
 */
export function serializedToTree(serialized: SerializedDockview): TreeNode | null {
  const panelDefs = serialized.panels as Record<string, { params?: { paneInstanceId?: number } }>;

  // Orientation.HORIZONTAL = 0, Orientation.VERTICAL = 1
  const rootIsHorizontal =
    (serialized.grid?.orientation ?? Orientation.HORIZONTAL) === Orientation.HORIZONTAL;

  const root = serialized.grid?.root as RawNode | undefined;
  if (!root) return null;

  try {
    const stack: WalkFrame[] = [
      { rawNode: root, isHoriz: rootIsHorizontal, childIdx: 0, childNodes: [] },
    ];
    let lastResult: TreeNode | null = null;

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const { rawNode, isHoriz } = frame;

      if (rawNode.type === "leaf") {
        const leaf = rawNode.data as { views?: string[] };
        const viewId = leaf.views?.[0];
        if (!viewId) return null;
        const id = panelDefs[viewId]?.params?.paneInstanceId;
        if (id == null) return null;
        lastResult = { kind: "panel", paneInstanceId: id };
        stack.pop();
        if (stack.length > 0)
          stack[stack.length - 1].childNodes.push({ node: lastResult, size: rawNode.size });
        continue;
      }

      if (rawNode.type === "branch") {
        const data = rawNode.data as RawNode[];

        // Single-leaf wrapper produced by the single-panel edge case in treeToSerialized
        if (data.length === 1 && data[0].type === "leaf") {
          const leaf = data[0].data as { views?: string[] };
          const viewId = leaf.views?.[0];
          if (!viewId) return null;
          const id = panelDefs[viewId]?.params?.paneInstanceId;
          if (id == null) return null;
          lastResult = { kind: "panel", paneInstanceId: id };
          stack.pop();
          if (stack.length > 0)
            stack[stack.length - 1].childNodes.push({ node: lastResult, size: rawNode.size });
          continue;
        }

        if (frame.childIdx < data.length) {
          const child = data[frame.childIdx++];
          stack.push({ rawNode: child, isHoriz: !isHoriz, childIdx: 0, childNodes: [] });
        } else {
          const direction: "h" | "v" = isHoriz ? "h" : "v";
          lastResult = { kind: "split", direction, children: frame.childNodes };
          stack.pop();
          if (stack.length > 0)
            stack[stack.length - 1].childNodes.push({ node: lastResult, size: rawNode.size });
        }
        continue;
      }

      return null; // unexpected node type
    }

    return lastResult;
  } catch {
    return null;
  }
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

  function makeLeaf(paneInstanceId: number, size: number): GridLeaf {
    groupCounter++;
    const groupId = `g-${groupCounter}`;
    const panelId = `paneInstance-${paneInstanceId}`;
    panels[panelId] = {
      id: panelId,
      contentComponent: "pane",
      tabComponent: "paneTab",
      params: { paneInstanceId },
      title: `Frame ${paneInstanceId}`,
    };
    return { type: "leaf", data: { id: groupId, views: [panelId], activeView: panelId }, size };
  }

  interface ConvertFrame {
    node: SplitNode;
    size: number;
    childIdx: number;
    childNodes: GridNode[];
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

  // Iterative convert using an explicit frame stack
  const convertStack: ConvertFrame[] = [{ node: root, size: 1000, childIdx: 0, childNodes: [] }];
  let gridRoot: GridNode | null = null;

  while (convertStack.length > 0) {
    const frame = convertStack[convertStack.length - 1];

    if (frame.childIdx < frame.node.children.length) {
      const child = frame.node.children[frame.childIdx++];
      if (child.node.kind === "panel") {
        frame.childNodes.push(makeLeaf(child.node.paneInstanceId, child.size));
      } else {
        convertStack.push({ node: child.node, size: child.size, childIdx: 0, childNodes: [] });
      }
    } else {
      const branch: GridBranch = { type: "branch", data: frame.childNodes, size: frame.size };
      convertStack.pop();
      if (convertStack.length > 0) {
        convertStack[convertStack.length - 1].childNodes.push(branch);
      } else {
        gridRoot = branch;
      }
    }
  }

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

  const stack: { node: TreeNode; x: number; y: number; width: number; height: number }[] = [
    { node: tree, x: 0, y: 0, width: cols, height: rows },
  ];

  while (stack.length > 0) {
    const { node, x, y, width, height } = stack.pop()!;

    if (node.kind === "panel") {
      rects[node.paneInstanceId - 1] = [x, y, width, height];
      continue;
    }

    const totalSize = node.children.reduce((sum, c) => sum + c.size, 0);
    let offset = 0;

    for (const child of node.children) {
      const proportion = child.size / totalSize;
      if (node.direction === "h") {
        const childWidth = width * proportion;
        stack.push({ node: child.node, x: x + offset, y, width: childWidth, height });
        offset += childWidth;
      } else {
        const childHeight = height * proportion;
        stack.push({ node: child.node, x, y: y + offset, width, height: childHeight });
        offset += childHeight;
      }
    }
  }

  return rects;
}
