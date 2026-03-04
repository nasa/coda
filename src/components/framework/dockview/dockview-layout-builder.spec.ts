import { describe, expect, it } from "vitest";
import {
  computeLayoutRects,
  hsplit,
  p,
  serializedToTree,
  stringToTree,
  treeToSerialized,
  treeToString,
  vsplit,
} from "./dockview-layout-builder";
import { Orientation } from "dockview-react";

// ---------------------------------------------------------------------------
// Builder functions
// ---------------------------------------------------------------------------

describe("builders", () => {
  it("p() creates a panel node", () => {
    expect(p(3)).toEqual({ kind: "panel", paneInstanceId: 3 });
  });

  it("hsplit() creates a horizontal split with correct direction and children", () => {
    const node = hsplit([p(1), 500], [p(2), 500]);
    expect(node.kind).toBe("split");
    expect(node.direction).toBe("h");
    expect(node.children).toHaveLength(2);
  });

  it("vsplit() creates a vertical split with correct direction and children", () => {
    const node = vsplit([p(1), 600], [p(2), 400]);
    expect(node.kind).toBe("split");
    expect(node.direction).toBe("v");
    expect(node.children).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// treeToString / stringToTree — DSL serialization
// ---------------------------------------------------------------------------

describe("treeToString()", () => {
  it("serializes a single panel", () => {
    expect(treeToString(p(3))).toBe("3");
  });

  it("serializes a flat h-split", () => {
    expect(treeToString(hsplit([p(1), 500], [p(2), 500]))).toBe("h(1:500,2:500)");
  });

  it("serializes a flat v-split", () => {
    expect(treeToString(vsplit([p(1), 600], [p(2), 400]))).toBe("v(1:600,2:400)");
  });

  it("serializes a nested tree", () => {
    const tree = vsplit([hsplit([p(1), 333], [p(2), 667]), 560], [p(3), 440]);
    expect(treeToString(tree)).toBe("v(h(1:333,2:667):560,3:440)");
  });

  it("serializes a three-level nested tree", () => {
    const inner = hsplit([p(1), 500], [p(2), 500]);
    const mid = vsplit([inner, 560], [p(5), 440]);
    const tree = hsplit([mid, 750], [p(3), 250]);
    expect(treeToString(tree)).toBe("h(v(h(1:500,2:500):560,5:440):750,3:250)");
  });

  it("rounds fractional sizes", () => {
    expect(treeToString(hsplit([p(1), 333.3], [p(2), 666.7]))).toBe("h(1:333,2:667)");
  });
});

describe("stringToTree() — valid", () => {
  it("parses a panel string", () => {
    expect(stringToTree("5")).toEqual(p(5));
  });

  it("parses a flat h-split", () => {
    expect(stringToTree("h(1:500,2:500)")).toEqual(hsplit([p(1), 500], [p(2), 500]));
  });

  it("parses a flat v-split", () => {
    expect(stringToTree("v(1:600,2:400)")).toEqual(vsplit([p(1), 600], [p(2), 400]));
  });

  it("parses a nested tree", () => {
    const tree = vsplit([hsplit([p(1), 333], [p(2), 667]), 560], [p(3), 440]);
    expect(stringToTree("v(h(1:333,2:667):560,3:440)")).toEqual(tree);
  });

  it("parses a three-level nested tree", () => {
    const inner = hsplit([p(1), 500], [p(2), 500]);
    const mid = vsplit([inner, 560], [p(5), 440]);
    const tree = hsplit([mid, 750], [p(3), 250]);
    expect(stringToTree("h(v(h(1:500,2:500):560,5:440):750,3:250)")).toEqual(tree);
  });

  it("trims leading/trailing whitespace", () => {
    expect(stringToTree("  3  ")).toEqual(p(3));
  });
});

describe("stringToTree() — malformed inputs (all must return null)", () => {
  it("empty string", () => {
    expect(stringToTree("")).toBeNull();
  });

  it("unknown direction character", () => {
    expect(stringToTree("x(1:500,2:500)")).toBeNull();
  });

  it("direction char not followed by '('", () => {
    expect(stringToTree("h1:500,2:500)")).toBeNull();
  });

  it("missing ':' after panel id inside a split", () => {
    expect(stringToTree("h(1500,2:500)")).toBeNull();
  });

  it("missing size after ':'", () => {
    expect(stringToTree("h(1:,2:500)")).toBeNull();
  });

  it("unclosed parenthesis", () => {
    expect(stringToTree("h(1:500,2:500")).toBeNull();
  });

  it("extra closing parenthesis", () => {
    expect(stringToTree("h(1:500,2:500))")).toBeNull();
  });

  it("trailing garbage after a valid top-level node", () => {
    expect(stringToTree("3xyz")).toBeNull();
  });

  it("empty split body", () => {
    expect(stringToTree("h()")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// treeToSerialized
// ---------------------------------------------------------------------------

describe("treeToSerialized()", () => {
  it("handles a single panel — wraps in a branch for Dockview compatibility", () => {
    const result = treeToSerialized(p(1));
    expect(result.grid.root.type).toBe("branch");
    expect(result.panels["paneInstance-1"]!.params!["paneInstanceId"]).toBe(1);
    expect(result.grid.orientation).toBe(Orientation.HORIZONTAL);
  });

  it("sets HORIZONTAL orientation for an h-split root", () => {
    const result = treeToSerialized(hsplit([p(1), 500], [p(2), 500]));
    expect(result.grid.orientation).toBe(Orientation.HORIZONTAL);
  });

  it("sets VERTICAL orientation for a v-split root", () => {
    const result = treeToSerialized(vsplit([p(1), 500], [p(2), 500]));
    expect(result.grid.orientation).toBe(Orientation.VERTICAL);
  });

  it("registers every panel in the panels map with the correct paneInstanceId", () => {
    const tree = vsplit([hsplit([p(1), 500], [p(2), 500]), 560], [p(3), 440]);
    const result = treeToSerialized(tree);
    expect(Object.keys(result.panels)).toHaveLength(3);
    expect(result.panels["paneInstance-1"]!.params!["paneInstanceId"]).toBe(1);
    expect(result.panels["paneInstance-2"]!.params!["paneInstanceId"]).toBe(2);
    expect(result.panels["paneInstance-3"]!.params!["paneInstanceId"]).toBe(3);
  });

  it("uses 'pane' and 'paneTab' as component keys (consumed by the renderer)", () => {
    const panel = treeToSerialized(p(7)).panels["paneInstance-7"];
    expect(panel.contentComponent).toBe("pane");
    expect(panel.tabComponent).toBe("paneTab");
  });
});

// ---------------------------------------------------------------------------
// serializedToTree
// ---------------------------------------------------------------------------

describe("serializedToTree()", () => {
  it("reconstructs a single-panel layout", () => {
    expect(serializedToTree(treeToSerialized(p(1)))).toEqual(p(1));
  });

  it("reconstructs a flat 2-panel h-split", () => {
    const tree = hsplit([p(1), 500], [p(2), 500]);
    expect(serializedToTree(treeToSerialized(tree))).toEqual(tree);
  });

  it("reconstructs a flat 2-panel v-split", () => {
    const tree = vsplit([p(1), 600], [p(2), 400]);
    expect(serializedToTree(treeToSerialized(tree))).toEqual(tree);
  });

  it("reconstructs a nested tree (h inside v)", () => {
    const tree = vsplit([hsplit([p(1), 500], [p(2), 500]), 560], [p(3), 440]);
    expect(serializedToTree(treeToSerialized(tree))).toEqual(tree);
  });

  it("reconstructs a three-level nested tree", () => {
    const inner = hsplit([p(1), 500], [p(2), 500]);
    const mid = vsplit([inner, 560], [p(5), 440]);
    const tree = hsplit([mid, 750], [p(3), 250]);
    expect(serializedToTree(treeToSerialized(tree))).toEqual(tree);
  });

  it("reconstructs a 3×3 grid layout", () => {
    const tree = vsplit(
      [hsplit([p(1), 333], [p(2), 333], [p(3), 334]), 333],
      [hsplit([p(4), 333], [p(5), 333], [p(6), 334]), 333],
      [hsplit([p(7), 333], [p(8), 333], [p(9), 334]), 334]
    );
    expect(serializedToTree(treeToSerialized(tree))).toEqual(tree);
  });

  it("assigns correct h/v directions via alternating-orientation inference", () => {
    // h-root → each child branch must be inferred as v
    const tree = hsplit(
      [vsplit([p(1), 500], [p(2), 500]), 500],
      [vsplit([p(3), 500], [p(4), 500]), 500]
    );
    const recovered = serializedToTree(treeToSerialized(tree));
    expect(recovered?.kind).toBe("split");
    if (recovered?.kind === "split") {
      expect(recovered.direction).toBe("h");
      for (const child of recovered.children) {
        expect(child.node.kind).toBe("split");
        if (child.node.kind === "split") expect(child.node.direction).toBe("v");
      }
    }
  });

  it("returns null when grid root is missing", () => {
    const snapshot = treeToSerialized(p(1));
    // @ts-expect-error — intentionally malformed
    delete snapshot.grid.root;
    expect(serializedToTree(snapshot)).toBeNull();
  });

  it("returns null when a panel has no paneInstanceId", () => {
    const snapshot = treeToSerialized(p(1));
    // @ts-expect-error — intentionally malformed
    delete snapshot.panels["paneInstance-1"].params.paneInstanceId;
    expect(serializedToTree(snapshot)).toBeNull();
  });

  it("returns null when a leaf has an empty views array", () => {
    const snapshot = treeToSerialized(p(1));
    // The single-panel path wraps in a branch whose only child is a leaf; clear its views.
    const branch = snapshot.grid.root as {
      type: string;
      data: Array<{ data: { views: string[] } }>;
    };
    branch.data[0].data.views = [];
    expect(serializedToTree(snapshot)).toBeNull();
  });

  it("returns null for an unknown node type", () => {
    const snapshot = treeToSerialized(p(1));
    // @ts-expect-error — intentionally malformed
    snapshot.grid.root.type = "unknown";
    expect(serializedToTree(snapshot)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeLayoutRects
// ---------------------------------------------------------------------------

describe("computeLayoutRects()", () => {
  it("returns a full-grid rect for a single panel", () => {
    expect(computeLayoutRects(p(1), 24, 9)[0]).toEqual([0, 0, 24, 9]);
  });

  it("splits horizontal space proportionally — equal (500/500)", () => {
    const rects = computeLayoutRects(hsplit([p(1), 500], [p(2), 500]), 24, 9);
    expect(rects[0]).toEqual([0, 0, 12, 9]);
    expect(rects[1]).toEqual([12, 0, 12, 9]);
  });

  it("splits horizontal space proportionally — unequal (750/250)", () => {
    const rects = computeLayoutRects(hsplit([p(1), 750], [p(2), 250]), 24, 9);
    expect(rects[0]).toEqual([0, 0, 18, 9]);
    expect(rects[1]).toEqual([18, 0, 6, 9]);
  });

  it("splits vertical space proportionally", () => {
    const rects = computeLayoutRects(vsplit([p(1), 500], [p(2), 500]), 24, 9);
    expect(rects[0]).toEqual([0, 0, 24, 4.5]);
    expect(rects[1]).toEqual([0, 4.5, 24, 4.5]);
  });

  it("computes nested rects correctly", () => {
    const tree = vsplit([hsplit([p(1), 500], [p(2), 500]), 500], [p(3), 500]);
    const rects = computeLayoutRects(tree, 24, 10);
    expect(rects[0]).toEqual([0, 0, 12, 5]);
    expect(rects[1]).toEqual([12, 0, 12, 5]);
    expect(rects[2]).toEqual([0, 5, 24, 5]);
  });

  it("indexes rects by paneInstanceId - 1 (panel 5 → index 4)", () => {
    const rects = computeLayoutRects(p(5), 24, 9);
    expect(rects[4]).toEqual([0, 0, 24, 9]);
    expect(rects[0]).toBeUndefined();
  });

  it("h-split panels tile without gap and cover the full grid width", () => {
    const rects = computeLayoutRects(hsplit([p(1), 333], [p(2), 333], [p(3), 334]), 24, 9);
    const [x1, , w1] = rects[0];
    const [x2, , w2] = rects[1];
    const [x3, , w3] = rects[2];
    expect(x1 + w1).toBeCloseTo(x2, 5);
    expect(x2 + w2).toBeCloseTo(x3, 5);
    expect(x3 + w3).toBeCloseTo(24, 5); // full width covered
  });

  it("v-split panels tile without gap and cover the full grid height", () => {
    const rects = computeLayoutRects(vsplit([p(1), 333], [p(2), 333], [p(3), 334]), 24, 9);
    const [, y1, , h1] = rects[0];
    const [, y2, , h2] = rects[1];
    const [, y3, , h3] = rects[2];
    expect(y1 + h1).toBeCloseTo(y2, 5);
    expect(y2 + h2).toBeCloseTo(y3, 5);
    expect(y3 + h3).toBeCloseTo(9, 5); // full height covered
  });
});
