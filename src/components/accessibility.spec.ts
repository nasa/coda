import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Accessibility compliance tests
 *
 * Validates that interactive elements across the CODA UI include the required
 * ARIA attributes and alt text for WCAG 2.1 AA compliance. These tests read
 * the component source files and assert that the accessibility attributes are
 * present, catching regressions without requiring a full browser/jsdom render.
 */

function readComponent(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

// ---------------------------------------------------------------------------
// GPS Location Pane
// ---------------------------------------------------------------------------

describe("gps-location accessibility", () => {
  const source = readComponent("panes/gps-location.tsx");

  it("marker images include descriptive alt text", () => {
    expect(source).toContain("alt={" + "`GPS marker icon for ${key}`}");
  });

  it("lock button has aria-label", () => {
    expect(source).toContain('aria-label="Toggle map scroll lock"');
  });
});

// ---------------------------------------------------------------------------
// Dockview Header Actions
// ---------------------------------------------------------------------------

describe("dockview-header-actions accessibility", () => {
  const source = readComponent("framework/dockview/dockview-header-actions.tsx");

  it("add panel button has aria-label", () => {
    expect(source).toContain('aria-label="Add panel"');
  });

  it("collapsed controls button has aria-label", () => {
    expect(source).toContain('aria-label="Toggle panel controls"');
  });
});

// ---------------------------------------------------------------------------
// Dockview Watermark
// ---------------------------------------------------------------------------

describe("dockview watermark accessibility", () => {
  const source = readComponent("framework/dockview/dockview.tsx");

  it("watermark add panel button has aria-label", () => {
    expect(source).toContain('aria-label="Add panel"');
  });
});

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

describe("header accessibility", () => {
  const source = readComponent("interface/header.tsx");

  it("help menu button has role and aria-label", () => {
    expect(source).toContain('role="button"');
    expect(source).toContain('aria-label="Toggle help menu"');
  });

  it("cancel time button has aria-label", () => {
    expect(source).toContain('aria-label="Cancel time edit"');
  });

  it("go time button has aria-label", () => {
    expect(source).toContain('aria-label="Apply time change"');
  });

  it("CODA wordmark has role and aria-label", () => {
    expect(source).toContain('aria-label="Go to CODA home"');
  });
});

// ---------------------------------------------------------------------------
// Comm Pane Controls
// ---------------------------------------------------------------------------

describe("comm controls accessibility", () => {
  const source = readComponent("panes/comm.tsx");

  it("channel dropdown button has aria-label and aria-expanded", () => {
    expect(source).toContain('aria-label="Toggle channel selection"');
    expect(source).toContain("aria-expanded={dropdownOpen}");
  });

  it("filter button has aria-label", () => {
    expect(source).toContain('aria-label="Toggle utterance filter"');
  });

  it("scroll lock button has aria-label", () => {
    expect(source).toContain('aria-label="Toggle auto-scroll lock"');
  });
});

// ---------------------------------------------------------------------------
// Video Controls
// ---------------------------------------------------------------------------

describe("video controls accessibility", () => {
  const source = readComponent("panes/video/video-controls.tsx");

  it("mute button has dynamic aria-label based on state", () => {
    expect(source).toContain("Unmute audio");
    expect(source).toContain("Mute audio");
  });

  it("IO info button has aria-label", () => {
    expect(source).toContain('aria-label="Toggle IO information"');
  });
});

// ---------------------------------------------------------------------------
// Help Button (shared component)
// ---------------------------------------------------------------------------

describe("pane help button accessibility", () => {
  const source = readComponent("interface/pane-help-control-button.tsx");

  it("has role='button' for the clickable div", () => {
    expect(source).toContain('role="button"');
  });

  it("has aria-label", () => {
    expect(source).toContain('aria-label="Toggle help overlay"');
  });
});
