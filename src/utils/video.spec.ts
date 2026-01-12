import {
  calculateChannelAvailability,
  hasHlsAvailable,
  hasIOAvailable,
  hasMtxAvailable,
  isAutoplayError,
  visibleVideosBySecond,
  filterVisibleVideos,
  determineVideoPlayerType,
} from "./video";

/**
 * These tests verify the logic of helper functions in video.ts.
 * The functions are copied here because video.ts uses import.meta.env which
 * Jest cannot parse without additional babel configuration.
 * The test implementations mirror the source exactly.
 */

describe("isAutoplayError", () => {
  test("returns true for Chrome autoplay error", () => {
    const error = new Error(
      "play() failed because the user didn't interact with the document first"
    );
    expect(isAutoplayError(error)).toBe(true);
  });

  test("returns true for Firefox autoplay error", () => {
    const error = new Error(
      "The play method is not allowed by the user agent or the platform in the current context, possibly because the user denied permission"
    );
    expect(isAutoplayError(error)).toBe(true);
  });

  test("returns true for Safari autoplay error", () => {
    const error = new Error(
      "The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission"
    );
    expect(isAutoplayError(error)).toBe(true);
  });

  test("returns false for unrelated errors", () => {
    const error = new Error("Network error");
    expect(isAutoplayError(error)).toBe(false);
  });

  test("handles non-Error objects", () => {
    expect(isAutoplayError("some string error")).toBe(false);
    expect(isAutoplayError({ message: "object error" })).toBe(false);
  });
});

describe("hasIOVideoAvailable", () => {
  test("returns true when video exists for channel at appSeconds + 1", () => {
    const visibleVideos = new Map<string, string[]>();
    visibleVideos.set("1001/0", ["video1.mp4"]);

    expect(hasIOAvailable(visibleVideos, 1000, 0)).toBe(true);
  });

  test("returns false when no video exists for channel", () => {
    const visibleVideos = new Map<string, string[]>();
    visibleVideos.set("1001/0", ["video1.mp4"]);

    expect(hasIOAvailable(visibleVideos, 1000, 1)).toBe(false);
  });
});

describe("hasHlsAvailable", () => {
  const createPlayhead = (appSeconds: number, date: string) => ({
    appSeconds,
    date,
  });

  test("returns false when playhead is not today", () => {
    const mtxHlsEndpoints: MTXHlsEndpoint[] = [{ name: "DL1_ISS", secondsAvailable: 3600 }];
    const playhead = createPlayhead(1000, "2020-01-01T00:00:00Z");

    expect(hasHlsAvailable(mtxHlsEndpoints, 1, "ISS", playhead.date, playhead.appSeconds)).toBe(
      false
    );
  });

  test("returns false when no matching endpoint exists", () => {
    const now = new Date();
    const mtxHlsEndpoints: MTXHlsEndpoint[] = [{ name: "DL2_ISS", secondsAvailable: 3600 }];
    const playhead = createPlayhead(
      Math.floor(now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()),
      now.toISOString()
    );

    expect(hasHlsAvailable(mtxHlsEndpoints, 1, "ISS", playhead.date, playhead.appSeconds)).toBe(
      false
    );
  });

  test("uses TE suffix for non-ISS source", () => {
    const now = new Date();
    const mtxHlsEndpoints: MTXHlsEndpoint[] = [{ name: "DL1_TE", secondsAvailable: 3600 }];
    const playhead = createPlayhead(
      Math.floor(now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()),
      now.toISOString()
    );

    expect(hasHlsAvailable(mtxHlsEndpoints, 1, "OTHER", playhead.date, playhead.appSeconds)).toBe(
      true
    );
  });
});

describe("hasMtxAvailable", () => {
  const createPlayhead = (appSeconds: number, date: string) => ({
    appSeconds,
    date,
  });

  test("returns false when mtxRecords is undefined", () => {
    const playhead = createPlayhead(1000, "2023-05-24T00:16:40Z");
    expect(hasMtxAvailable(undefined, playhead.date, playhead.appSeconds)).toBe(false);
  });

  test("returns true when playhead is within a recording range", () => {
    const playheadDate = "2023-05-24T00:16:40Z";
    const mtxRecords: MTXRecordingTimeRange[] = [
      { start: "2023-05-24T00:10:00Z", duration: 600 }, // 600 to 1200 appSeconds
    ];
    const playhead = createPlayhead(1000, playheadDate);

    expect(hasMtxAvailable(mtxRecords, playhead.date, playhead.appSeconds)).toBe(true);
  });

  test("returns false when playhead is before recording range", () => {
    const playheadDate = "2023-05-24T00:05:00Z";
    const mtxRecords: MTXRecordingTimeRange[] = [{ start: "2023-05-24T00:10:00Z", duration: 600 }];
    const playhead = createPlayhead(300, playheadDate);

    expect(hasMtxAvailable(mtxRecords, playhead.date, playhead.appSeconds)).toBe(false);
  });

  test("returns false when playhead is after recording range", () => {
    const playheadDate = "2023-05-24T00:25:00Z";
    const mtxRecords: MTXRecordingTimeRange[] = [
      { start: "2023-05-24T00:10:00Z", duration: 600 }, // ends at appSeconds 1200
    ];
    const playhead = createPlayhead(1500, playheadDate);

    expect(hasMtxAvailable(mtxRecords, playhead.date, playhead.appSeconds)).toBe(false);
  });

  test("returns false when record date does not match playhead date", () => {
    const playheadDate = "2023-05-24T00:16:40Z";
    const mtxRecords: MTXRecordingTimeRange[] = [{ start: "2023-05-23T00:10:00Z", duration: 600 }];
    const playhead = createPlayhead(1000, playheadDate);

    expect(hasMtxAvailable(mtxRecords, playhead.date, playhead.appSeconds)).toBe(false);
  });
});

describe("calculateChannelAvailability", () => {
  const createPlayhead = (appSeconds: number, date: string) => ({
    appSeconds,
    date,
  });

  test("returns IO availability only when liveEnabled is false", () => {
    const playhead = createPlayhead(1000, "2023-05-24T00:16:40Z");
    const visibleVideos = new Map<string, string[]>();
    visibleVideos.set("1001/0", ["video.mp4"]); // channel 0 has IO video
    visibleVideos.set("1001/2", ["video.mp4"]); // channel 2 has IO video

    const result = calculateChannelAvailability(
      playhead.date,
      playhead.appSeconds,
      visibleVideos,
      {},
      [],
      "ISS",
      false // liveEnabled = false
    );

    expect(result).toEqual([true, false, true, false, false, false, false, false]);
  });

  test("returns all false when no videos available", () => {
    const playhead = createPlayhead(1000, "2023-05-24T00:16:40Z");
    const visibleVideos = new Map<string, string[]>();

    const result = calculateChannelAvailability(
      playhead.date,
      playhead.appSeconds,
      visibleVideos,
      {},
      [],
      "ISS",
      false
    );

    expect(result).toEqual([false, false, false, false, false, false, false, false]);
  });

  test("includes MTX availability when liveEnabled is true", () => {
    const playhead = createPlayhead(1000, "2023-05-24T00:16:40Z");
    const visibleVideos = new Map<string, string[]>();
    const mtxPlaybackAvailability: MTXPlaybackAvailability = {
      "1": [{ start: "2023-05-24T00:10:00Z", duration: 600 }], // channel 0 (DL1) has MTX
    };

    const result = calculateChannelAvailability(
      playhead.date,
      playhead.appSeconds,
      visibleVideos,
      mtxPlaybackAvailability,
      [],
      "ISS",
      true // liveEnabled = true
    );

    expect(result[0]).toBe(true); // channel 0 available via MTX
    expect(result[1]).toBe(false); // channel 1 not available
  });
});

describe("visibleVideosBySecond", () => {
  test("creates map with correct keys for videos", () => {
    const videos: VideoFile[] = [
      {
        id: "video1",
        start: 1716508800, // 2024-05-24T00:00:00Z
        end: 1716508802, // 2024-05-24T00:00:02Z
        downlink: 0,
      } as VideoFile,
    ];
    const date = new Date("2024-05-24T00:00:00Z");

    const result = visibleVideosBySecond(videos, date);

    expect(result.get("0/0")).toEqual(["video1"]);
    expect(result.get("1/0")).toEqual(["video1"]);
    expect(result.get("2/0")).toEqual(["video1"]);
  });

  test("returns empty map for empty video list", () => {
    const date = new Date("2024-05-24T00:00:00Z");
    const result = visibleVideosBySecond([], date);

    expect(result.size).toBe(0);
  });

  test("groups multiple videos at same second/downlink", () => {
    const videos: VideoFile[] = [
      {
        id: "video1",
        start: 1716508800,
        end: 1716508801,
        downlink: 0,
      } as VideoFile,
      {
        id: "video2",
        start: 1716508800,
        end: 1716508801,
        downlink: 0,
      } as VideoFile,
    ];
    const date = new Date("2024-05-24T00:00:00Z");

    const result = visibleVideosBySecond(videos, date);

    expect(result.get("0/0")).toEqual(["video1", "video2"]);
  });
});

describe("filterVisibleVideos", () => {
  test("filters videos that overlap with the given day", () => {
    const date = new Date("2024-05-24T00:00:00Z");
    const startOfDay = date.valueOf() / 1000;
    const videos: VideoFile[] = [
      { id: "v1", start: startOfDay + 100, end: startOfDay + 200 } as VideoFile, // within day
      { id: "v2", start: startOfDay - 100, end: startOfDay + 100 } as VideoFile, // overlaps start
      { id: "v3", start: startOfDay + 86300, end: startOfDay + 86500 } as VideoFile, // overlaps end
      { id: "v4", start: startOfDay - 200, end: startOfDay - 100 } as VideoFile, // before day
      { id: "v5", start: startOfDay + 86400, end: startOfDay + 86500 } as VideoFile, // after day
    ];

    const result = filterVisibleVideos(videos, date);

    expect(result.map((v) => v.id)).toEqual(["v1", "v2", "v3"]);
  });

  test("returns empty array for no overlapping videos", () => {
    const date = new Date("2024-05-24T00:00:00Z");
    const startOfDay = date.valueOf() / 1000;
    const videos: VideoFile[] = [
      { id: "v1", start: startOfDay - 200, end: startOfDay - 100 } as VideoFile, // before day
    ];

    const result = filterVisibleVideos(videos, date);

    expect(result).toEqual([]);
  });
});

describe("determineVideoPlayerType", () => {
  const createVideosState = (
    videoFiles: VideoFile[] = [],
    mtxHlsEndpoints: MTXHlsEndpoint[] = []
  ): VideosState => ({
    videoFiles,
    mtxPlaybackAvailability: {},
    mtxHlsEndpoints,
    metadataIo: null,
    metadataMtx: null,
  });

  test("returns IO when IO video is available", () => {
    // Use unique date to avoid memoization conflicts with other tests
    const date = new Date("2024-06-15T00:00:00Z");
    const startOfDay = date.valueOf() / 1000;
    // Video covers appSeconds 1000-1010 (relative to start of day)
    // hasIOVideoAvailable checks for appSeconds + 1, so playhead at 1001 checks key "1002/0"
    const videos = createVideosState([
      { id: "v1", start: startOfDay + 1000, end: startOfDay + 1010, downlink: 0 } as VideoFile,
    ]);

    const result = determineVideoPlayerType({
      downlinkNumber: 1,
      mtxPlaybackRecordsForDownlink: undefined,
      videos,
      date: "2024-06-15T00:00:00Z",
      appSeconds: 1001,
      source: "ISS",
    });

    expect(result).toBe("IO");
  });

  test("returns MTX when only MTX is available", () => {
    const videos = createVideosState();
    const mtxRecords: MTXRecordingTimeRange[] = [{ start: "2023-05-24T00:10:00Z", duration: 600 }];

    const result = determineVideoPlayerType({
      downlinkNumber: 1,
      mtxPlaybackRecordsForDownlink: mtxRecords,
      videos,
      date: "2023-05-24T00:16:40Z",
      appSeconds: 1000,
      source: "ISS",
    });

    expect(result).toBe("MTX");
  });

  test("returns NONE when no source is available", () => {
    const videos = createVideosState();

    const result = determineVideoPlayerType({
      downlinkNumber: 1,
      mtxPlaybackRecordsForDownlink: undefined,
      videos,
      date: "2023-05-24T00:16:40Z",
      appSeconds: 1000,
      source: "ISS",
    });

    expect(result).toBe("NONE");
  });
});

describe("hasHlsAvailable", () => {
  test("returns false when not today", () => {
    const mtxHlsEndpoints: MTXHlsEndpoint[] = [{ name: "DL1_ISS", secondsAvailable: 3600 }];

    const result = hasHlsAvailable(mtxHlsEndpoints, 1, "ISS", "2020-01-01T00:00:00Z", 1000);

    expect(result).toBe(false);
  });

  test("returns true when HLS is available today", () => {
    const now = new Date();
    const mtxHlsEndpoints: MTXHlsEndpoint[] = [{ name: "DL1_ISS", secondsAvailable: 3600 }];
    const nowAppSeconds = Math.floor(
      now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()
    );

    const result = hasHlsAvailable(mtxHlsEndpoints, 1, "ISS", now.toISOString(), nowAppSeconds);

    expect(result).toBe(true);
  });
});
