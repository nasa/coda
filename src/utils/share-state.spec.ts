import {
  validateShareLinkDateTime,
  generateShareURL,
  interpretFramestateQueryString,
  interpretFrameQueryParam,
  getStateStringForVideo,
  getStateStringForPhoto,
  getStateStringForPhotoAll,
  getStateStringForEventInfo,
  getStateStringforISSLocation,
  getStateStringforGPSLocation,
  getStateStringForComm,
  getStateStringForGraph,
} from "./share-state";
import { getDockviewApi } from "components/framework/dockview/dockview-api-ref";
import { paneTypeShortVal } from "utils/consts";

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

  it("returns null when the Dockview API is not yet available", () => {
    // getDockviewApi returns null before Dockview has fired its onReady event.
    // generateShareURL must short-circuit and return null in that case.
    vi.mocked(getDockviewApi).mockReturnValue(null);
    const framework: FrameworkState = {
      layout: "c",
      layoutLastChanged: 0,
      source: "ISS",
      paneInstances: {},
    };
    expect(generateShareURL(framework, "2024-03-10", 36000)).toBeNull();
  });

  it("uses paneInstance keys as f-param indices and encodes correct state strings", () => {
    // Verify f-param keys match actual paneInstance IDs (not a sequential counter) and
    // that each pane type's encoder is correctly dispatched from the switch statement.
    // With paneInstances {1, 5, 6}, f1/f5/f6 must be present and f2/f3/f4 must be absent.
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
        "2": {
          paneType: "video_non_downlink",
          paneStateData: {
            ready: true,
            channel: -1,
            activeVideoFileID: "clip",
            muted: false,
            showHelp: false,
          } as VideoPaneStateData,
        },
        "3": {
          paneType: "photo",
          paneStateData: {
            ready: true,
            showInfo: false,
            showFilter: false,
            showHelp: false,
          } as PhotoPaneStateData,
        },
        "4": {
          paneType: "photo_all",
          paneStateData: {
            ready: true,
            showFilter: true,
            lockScroll: true,
            showHelp: false,
          } as PhotoAllPaneStateData,
        },
        "5": {
          paneType: "event_info",
          paneStateData: { ready: true, showHelp: false } as EventPaneStateData,
        },
        "6": {
          paneType: "iss_location",
          paneStateData: { ready: true, lockMap: true, showHelp: false } as LocationPaneStateData,
        },
        "7": {
          paneType: "gps_location",
          paneStateData: {
            ready: true,
            lockMap: false,
            showHelp: false,
            gpsTrackToggles: { EV1: true },
          } as GpsTrackPaneStateData,
        },
        "8": {
          paneType: "comm",
          paneStateData: {
            ready: true,
            lockScroll: true,
            filterActive: false,
            sgChannels: [],
            unselectedSgChannels: [],
            isMuted: false,
            showHelp: true,
          } as CommPaneStateData,
        },
        "10": {
          paneType: "graph",
          paneStateData: {
            ready: true,
            lockScroll: true,
            showHelp: false,
            selectedGraphId: "hr",
          } as GraphPaneStateData,
        },
      },
    };
    const url = generateShareURL(framework, "2024-03-10", 36000)!;
    expect(url).toContain("f1=01001"); // video_downlink
    expect(url).toContain("f2=02-10clip"); // video_non_downlink
    expect(url).toContain("f3=0300"); // photo
    expect(url).toContain("f4=0711"); // photo_all
    expect(url).toContain("f5=04"); // event_info
    expect(url).toContain("f6=051"); // iss_location
    expect(url).toContain("f7=060EV1"); // gps_location
    expect(url).toContain("f8=08"); // comm
    expect(url).toContain("f10=101hr"); // graph — key "10" → f10
    // f9 not present since paneInstance "9" doesn't exist
    expect(url).not.toContain("f9=");
  });
});

describe("pane state encoders", () => {
  it("encodes video_downlink: channel, muted, activeVideoFileID", () => {
    expect(
      getStateStringForVideo(
        { channel: 2, muted: true, activeVideoFileID: "" } as VideoPaneStateData,
        paneTypeShortVal.video_downlink
      )
    ).toBe("01021");
    expect(
      getStateStringForVideo(
        { channel: 2, muted: false, activeVideoFileID: "" } as VideoPaneStateData,
        paneTypeShortVal.video_downlink
      )
    ).toBe("01020");
    expect(
      getStateStringForVideo(
        { channel: 0, muted: true, activeVideoFileID: "abc" } as VideoPaneStateData,
        paneTypeShortVal.video_downlink
      )
    ).toBe("01001abc");
  });

  it("encodes video_non_downlink: channel is always -1", () => {
    expect(
      getStateStringForVideo(
        { channel: -1, muted: false, activeVideoFileID: "clip" } as VideoPaneStateData,
        paneTypeShortVal.video_non_downlink
      )
    ).toBe("02-10clip");
    expect(
      getStateStringForVideo(
        { channel: -1, muted: true, activeVideoFileID: "" } as VideoPaneStateData,
        paneTypeShortVal.video_non_downlink
      )
    ).toBe("02-11");
  });

  it("encodes photo: showInfo and showFilter flags", () => {
    expect(
      getStateStringForPhoto({ showInfo: false, showFilter: false } as PhotoPaneStateData)
    ).toBe("0300");
    expect(
      getStateStringForPhoto({ showInfo: true, showFilter: false } as PhotoPaneStateData)
    ).toBe("0310");
    expect(
      getStateStringForPhoto({ showInfo: false, showFilter: true } as PhotoPaneStateData)
    ).toBe("0301");
    expect(getStateStringForPhoto({ showInfo: true, showFilter: true } as PhotoPaneStateData)).toBe(
      "0311"
    );
  });

  it("encodes photo_all: showFilter and lockScroll flags", () => {
    expect(
      getStateStringForPhotoAll({ showFilter: false, lockScroll: false } as PhotoAllPaneStateData)
    ).toBe("0700");
    expect(
      getStateStringForPhotoAll({ showFilter: true, lockScroll: true } as PhotoAllPaneStateData)
    ).toBe("0711");
    expect(
      getStateStringForPhotoAll({ showFilter: true, lockScroll: false } as PhotoAllPaneStateData)
    ).toBe("0710");
  });

  it("encodes event_info: pane type only", () => {
    expect(getStateStringForEventInfo()).toBe("04");
  });

  it("encodes iss_location: lockMap flag", () => {
    expect(getStateStringforISSLocation({ lockMap: true } as LocationPaneStateData)).toBe("051");
    expect(getStateStringforISSLocation({ lockMap: false } as LocationPaneStateData)).toBe("050");
  });

  it("encodes gps_location: lockMap flag and enabled track names", () => {
    // Only tracks with value=true are included in the string; disabled tracks are omitted.
    expect(
      getStateStringforGPSLocation({
        lockMap: false,
        gpsTrackToggles: { EV1: true, EV2: false, EV3: true },
      } as unknown as GpsTrackPaneStateData)
    ).toBe("060EV1,EV3");
    expect(
      getStateStringforGPSLocation({
        lockMap: true,
        gpsTrackToggles: { EV1: true },
      } as unknown as GpsTrackPaneStateData)
    ).toBe("061EV1");
    expect(
      getStateStringforGPSLocation({
        lockMap: false,
        gpsTrackToggles: {},
      } as unknown as GpsTrackPaneStateData)
    ).toBe("060");
  });

  it("encodes comm: pane type only (channel info not stored)", () => {
    expect(getStateStringForComm({} as CommPaneStateData)).toBe("08");
  });

  it("encodes graph: lockScroll flag and selectedGraphId", () => {
    expect(
      getStateStringForGraph({
        lockScroll: true,
        selectedGraphId: "heart-rate",
      } as GraphPaneStateData)
    ).toBe("101heart-rate");
    expect(
      getStateStringForGraph({ lockScroll: false, selectedGraphId: "co2" } as GraphPaneStateData)
    ).toBe("100co2");
  });
});

describe("interpretFrameQueryParam", () => {
  it("decodes video_downlink: channel, muted, activeVideoFileID", () => {
    const result = interpretFrameQueryParam("01021abc")!;
    expect(result.paneType).toBe("video_downlink");
    const data = result.paneStateData as VideoPaneStateData;
    expect(data.channel).toBe(2);
    expect(data.muted).toBe(true);
    expect(data.activeVideoFileID).toBe("abc");
  });

  it("decodes video_non_downlink: channel always -1, muted flag, fileID", () => {
    const result = interpretFrameQueryParam("02-11myfile")!;
    expect(result.paneType).toBe("video_non_downlink");
    const data = result.paneStateData as VideoPaneStateData;
    expect(data.channel).toBe(-1);
    expect(data.muted).toBe(true);
    expect(data.activeVideoFileID).toBe("myfile");
  });

  it("decodes photo: showInfo and showFilter flags", () => {
    const on = interpretFrameQueryParam("0311")!.paneStateData as PhotoPaneStateData;
    const off = interpretFrameQueryParam("0300")!.paneStateData as PhotoPaneStateData;
    expect(on.showInfo).toBe(true);
    expect(on.showFilter).toBe(true);
    expect(off.showInfo).toBe(false);
    expect(off.showFilter).toBe(false);
  });

  it("decodes photo_all: showFilter and lockScroll flags", () => {
    const data = interpretFrameQueryParam("0710")!.paneStateData as PhotoAllPaneStateData;
    expect(data.showFilter).toBe(true);
    expect(data.lockScroll).toBe(false);
  });

  it("decodes event_info: no extra state", () => {
    expect(interpretFrameQueryParam("04")!.paneType).toBe("event_info");
  });

  it("decodes iss_location: lockMap flag", () => {
    expect((interpretFrameQueryParam("051")!.paneStateData as LocationPaneStateData).lockMap).toBe(
      true
    );
    expect((interpretFrameQueryParam("050")!.paneStateData as LocationPaneStateData).lockMap).toBe(
      false
    );
  });

  it("decodes gps_location: lockMap flag and enabled track names", () => {
    const data = interpretFrameQueryParam("061EV1,EV3")!.paneStateData as GpsTrackPaneStateData;
    expect(data.lockMap).toBe(true);
    expect(data.gpsTrackToggles).toEqual({ EV1: true, EV3: true });
  });

  it("decodes gps_location legacy format (no tracks defaults to EV1/EV2)", () => {
    // Legacy links omit the track list entirely; the decoder defaults to EV1+EV2.
    const data = interpretFrameQueryParam("060")!.paneStateData as GpsTrackPaneStateData;
    expect(data.gpsTrackToggles).toEqual({ EV1: true, EV2: true });
  });

  it("decodes comm", () => {
    expect(interpretFrameQueryParam("08")!.paneType).toBe("comm");
  });

  it("decodes graph: lockScroll flag and selectedGraphId", () => {
    const data = interpretFrameQueryParam("101heart-rate")!.paneStateData as GraphPaneStateData;
    expect(data.lockScroll).toBe(true);
    expect(data.selectedGraphId).toBe("heart-rate");
  });

  it("returns undefined for unrecognised pane type codes", () => {
    // An unknown pane type (e.g. from a future version) must not crash and must
    // return undefined so the caller can safely omit it.
    expect(interpretFrameQueryParam("99")).toBeUndefined();
  });
});

describe("interpretFramestateQueryString", () => {
  it("maps non-sequential f-params to their matching paneInstance IDs", () => {
    // interpretFramestateQueryString maps each fn param directly to paneInstance key "n".
    // When the share link skips f2/f3/f4 (because those panels were removed), the
    // resulting paneInstances object must also skip those keys — not re-number them.
    const params = new URLSearchParams("f1=01001&f5=08&f6=0300");
    const result = interpretFramestateQueryString(params);

    expect(Object.keys(result)).toEqual(["1", "5", "6"]);
    expect(result["1"].paneType).toBe("video_downlink");
    expect(result["5"].paneType).toBe("comm");
    expect(result["6"].paneType).toBe("photo");
    expect(result["2"]).toBeUndefined();
    expect(result["3"]).toBeUndefined();
    expect(result["4"]).toBeUndefined();
  });

  it("returns an empty object when no f-params are present", () => {
    // A URL with no frame params (e.g. only date/gmt) must produce an empty map.
    const params = new URLSearchParams("date=2024-03-10&gmt=10:00:00");
    expect(interpretFramestateQueryString(params)).toEqual({});
  });

  it("silently drops f-params with unrecognised pane type codes", () => {
    // When interpretFrameQueryParam returns undefined (unknown pane type), the
    // entry must be omitted from the result rather than crashing or inserting undefined.
    const params = new URLSearchParams("f1=01001&f2=99");
    const result = interpretFramestateQueryString(params);
    expect(result["1"].paneType).toBe("video_downlink");
    expect(result["2"]).toBeUndefined();
  });
});
