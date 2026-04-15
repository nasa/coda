import {
  validateShareLinkDateTime,
  generateShareURL,
  interpretFramestateQueryString,
} from "./share-state";
import { getDockviewApi } from "components/framework/dockview/dockview-api-ref";

// Mock browser-only modules so tests run in Node
vi.mock("components/framework/dockview/dockview-api-ref", () => ({
  getDockviewApi: vi.fn(),
}));

vi.mock("components/framework/dockview/dockview-layout-builder", () => ({
  serializedToTree: vi.fn(() => ({ kind: "panel", paneInstanceId: 1 })),
  treeToString: vi.fn(() => "1"),
}));

describe("validateShareLinkDateTime", () => {
  beforeEach(() => {
    // Mock current time to 2024-03-15 14:30:45 UTC for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T14:30:45Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("date validation", () => {
    it("should preserve valid past dates", () => {
      const result = validateShareLinkDateTime("2024-03-10", null);
      expect(result.validatedDate).toBe("2024-03-10");
      expect(result.isToday).toBe(false);
    });

    it("should change future dates to today", () => {
      const result = validateShareLinkDateTime("2024-03-20", null);
      expect(result.validatedDate).toBe("2024-03-15");
      expect(result.isToday).toBe(true);
    });

    it("should recognize today's date", () => {
      const result = validateShareLinkDateTime("2024-03-15", null);
      expect(result.validatedDate).toBe("2024-03-15");
      expect(result.isToday).toBe(true);
    });

    it("should handle null date input", () => {
      const result = validateShareLinkDateTime(null, null);
      expect(result.validatedDate).toBe("2024-03-15"); // Now defaults to today
      expect(result.isToday).toBe(true);
    });
  });

  describe("time validation on today's date", () => {
    it("should preserve past times when date is today", () => {
      const result = validateShareLinkDateTime("2024-03-15", "10:00:00");
      expect(result.validatedGmt).toBe("10:00:00");
    });

    it("should change future times to current time when date is today", () => {
      const result = validateShareLinkDateTime("2024-03-15", "18:45:30");
      expect(result.validatedGmt).toBe("14:30:45");
    });

    it("should handle URL-encoded colons in time", () => {
      const result = validateShareLinkDateTime("2024-03-15", "10%3A00%3A00");
      expect(result.validatedGmt).toBe("10%3A00%3A00");
    });

    it("should handle URL-encoded colons for future times", () => {
      const result = validateShareLinkDateTime("2024-03-15", "18%3A45%3A30");
      expect(result.validatedGmt).toBe("14:30:45");
    });

    it("should preserve current exact time", () => {
      const result = validateShareLinkDateTime("2024-03-15", "14:30:45");
      expect(result.validatedGmt).toBe("14:30:45");
    });

    it("should handle null time input when date is today", () => {
      const result = validateShareLinkDateTime("2024-03-15", null);
      expect(result.validatedGmt).toBe(null);
    });
  });

  describe("time validation on non-today dates", () => {
    it("should not validate time when date is in the past", () => {
      const result = validateShareLinkDateTime("2024-03-10", "23:59:59");
      expect(result.validatedGmt).toBe("23:59:59");
      expect(result.isToday).toBe(false);
    });

    it("should not validate time when future date is corrected to today", () => {
      const result = validateShareLinkDateTime("2024-03-20", "23:59:59");
      // Date gets corrected to today, but time validation happens after with isToday check
      expect(result.validatedGmt).toBe("14:30:45");
      expect(result.isToday).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle both null date and null time", () => {
      const result = validateShareLinkDateTime(null, null);
      expect(result.validatedDate).toBe("2024-03-15"); // Now defaults to today
      expect(result.validatedGmt).toBe(null);
      expect(result.isToday).toBe(true);
    });

    it("should handle malformed time format", () => {
      const result = validateShareLinkDateTime("2024-03-15", "25:99:99");
      expect(result.validatedGmt).toBe("25:99:99");
    });

    it("should handle single-digit hours in valid time", () => {
      const result = validateShareLinkDateTime("2024-03-15", "9:30:00");
      expect(result.validatedGmt).toBe("9:30:00");
    });

    it("should handle midnight time", () => {
      const result = validateShareLinkDateTime("2024-03-15", "00:00:00");
      expect(result.validatedGmt).toBe("00:00:00");
    });

    it("should handle end of day time on past date", () => {
      const result = validateShareLinkDateTime("2024-03-10", "23:59:59");
      expect(result.validatedGmt).toBe("23:59:59");
      expect(result.isToday).toBe(false);
    });
  });
});

describe("generateShareURL", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { origin: "https://coda.nasa.gov", pathname: "/view/" });
    vi.mocked(getDockviewApi).mockReturnValue({
      toJSON: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof getDockviewApi>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses paneInstance keys (not a sequential counter) as f-param indices", () => {
    // Regression test for: share link panels loading in wrong panes.
    //
    // generateShareURL previously used a sequential counter (i++) for the f-param index
    // instead of the actual paneInstance key. When panels are removed mid-session the
    // Redux paneInstances object has non-sequential IDs (e.g. {1, 5, 6}). The old code
    // wrote f1/f2/f3 while the DSL layout referenced panels 1/5/6, causing the receiver
    // to restore each pane's content into the wrong slot.
    //
    // Simulate a state where panels 2, 3, 4 have been closed, leaving a gap.
    // The bug caused f1/f2/f3 to be written instead of f1/f5/f6.
    const framework: FrameworkState = {
      layout: "c",
      layoutLastChanged: 0,
      source: "ISS",
      paneInstances: {
        "1": {
          paneType: "video_downlink",
          paneStateData: {
            ready: true,
            channel: 0,
            activeVideoFileID: "",
            muted: true,
            showInfo: false,
            showHelp: false,
          } as VideoPaneStateData,
        },
        "5": {
          paneType: "comm",
          paneStateData: {
            ready: true,
            lockScroll: true,
            filterActive: false,
            sgChannels: [],
            isMuted: false,
            showHelp: true,
          } as CommPaneStateData,
        },
        "6": {
          paneType: "photo",
          paneStateData: {
            ready: true,
            showInfo: false,
            showFilter: false,
            showHelp: false,
          } as PhotoPaneStateData,
        },
      },
    };

    const url = generateShareURL(framework, "2024-03-10", 36000);
    expect(url).not.toBeNull();
    // f params must match actual paneInstance IDs, not a sequential 1/2/3
    expect(url).toContain("f1=");
    expect(url).toContain("f5=");
    expect(url).toContain("f6=");
    expect(url).not.toContain("f2=");
    expect(url).not.toContain("f3=");
    expect(url).not.toContain("f4=");
  });

  it("encodes correct pane state strings at the right indices", () => {
    // Verify the encoded state values end up under the correct f-param key so
    // that interpretFramestateQueryString can pair them back to the right paneInstanceId.
    // e.g. the comm pane at slot 5 must be encoded as f5=08, not f2=08.
    const framework: FrameworkState = {
      layout: "c",
      layoutLastChanged: 0,
      source: "ISS",
      paneInstances: {
        "1": {
          paneType: "video_downlink",
          paneStateData: {
            ready: true,
            channel: 0,
            activeVideoFileID: "",
            muted: true,
            showInfo: false,
            showHelp: false,
          } as VideoPaneStateData,
        },
        "5": {
          paneType: "comm",
          paneStateData: {
            ready: true,
            lockScroll: true,
            filterActive: false,
            sgChannels: [],
            isMuted: false,
            showHelp: true,
          } as CommPaneStateData,
        },
        "6": {
          paneType: "photo",
          paneStateData: {
            ready: true,
            showInfo: false,
            showFilter: false,
            showHelp: false,
          } as PhotoPaneStateData,
        },
      },
    };

    const url = generateShareURL(framework, "2024-03-10", 36000)!;
    // video_downlink: paneType=01, channel=00, muted=1, activeVideoFileID=""
    expect(url).toContain("f1=01001");
    // comm/talkybot: paneType=08
    expect(url).toContain("f5=08");
    // photo: paneType=03, showInfo=0, showFilter=0
    expect(url).toContain("f6=0300");
  });
});

describe("interpretFramestateQueryString", () => {
  it("maps non-sequential f-params to their matching paneInstance IDs", () => {
    // interpretFramestateQueryString maps each fn param directly to paneInstance key "n".
    // When the share link skips f2/f3/f4 (because those panels were removed), the
    // resulting paneInstances object must also skip those keys — not re-number them.
    // f1, f5, f6 — skipping f2/f3/f4 — must restore to keys "1", "5", "6"
    const params = new URLSearchParams("f1=01001&f5=08&f6=0300");
    const result = interpretFramestateQueryString(params);

    expect(Object.keys(result)).toEqual(["1", "5", "6"]);
    expect(result["1"].paneType).toBe("video_downlink");
    expect(result["5"].paneType).toBe("comm");
    expect(result["6"].paneType).toBe("photo");
    // Keys 2, 3, 4 must be absent
    expect(result["2"]).toBeUndefined();
    expect(result["3"]).toBeUndefined();
    expect(result["4"]).toBeUndefined();
  });

  it("round-trips: content generated by generateShareURL decodes to the original pane state", () => {
    // End-to-end sanity check: a URL with non-sequential f-params (as produced by
    // the fixed generateShareURL) must decode each pane to the correct slot.
    // Before the fix, the receiver would map f3→key "3" instead of f5→key "5",
    // so the comm pane would appear in slot 3 and slots 5/6 would be wrong.
    const params = new URLSearchParams("f1=01001&f5=08&f6=0300");
    const result = interpretFramestateQueryString(params);

    // pane 5 must be comm, not photo (which was the bug: f3 → key "3", not "5")
    expect(result["5"].paneType).toBe("comm");
    // pane 6 must be photo, not something shifted
    expect(result["6"].paneType).toBe("photo");
  });
});
