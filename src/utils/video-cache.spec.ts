import {
  calculateChannelAvailability,
  determineVideoPlayerType,
  filterVisibleVideos,
  visibleVideosBySecond,
} from "./video";

const date = new Date("2024-07-01T00:00:00Z");
const epoch = date.valueOf() / 1000;
const video = (id: string, start = 10, end = 12, downlink = 0): VideoFile =>
  ({ id, start: epoch + start, end: epoch + end, downlink }) as VideoFile;

describe("video caches", () => {
  test("replaces same-length second maps when refreshed video IDs change", () => {
    const original = [video("old")];
    const refreshed = [video("new")];
    const oldMap = visibleVideosBySecond(original, date);
    const newMap = visibleVideosBySecond(refreshed, date);
    expect(oldMap.get("10/0")).toEqual(["old"]);
    expect(newMap.get("10/0")).toEqual(["new"]);
    expect(visibleVideosBySecond(original, date)).toBe(oldMap);
  });

  test("updates timestamps and channels even when list length stays the same", () => {
    visibleVideosBySecond([video("old", 10, 12, 0)], date);
    const result = visibleVideosBySecond([video("new", 20, 22, 3)], date);
    expect(result.has("10/0")).toBe(false);
    expect([...result.entries()]).toEqual([
      ["20/3", ["new"]],
      ["21/3", ["new"]],
      ["22/3", ["new"]],
    ]);
  });

  test("filters the current list rather than returning another source's videos", () => {
    const original = [video("first")];
    const replacement = [video("second")];
    expect(filterVisibleVideos(original, date)).toEqual(original);
    const result = filterVisibleVideos(replacement, date);
    expect(result).toEqual(replacement);
    expect(result[0]).toBe(replacement[0]);
  });

  test("recomputes overlap after an equal-length timestamp refresh", () => {
    filterVisibleVideos([video("visible")], date);
    expect(filterVisibleVideos([video("outside", -20, -10)], date)).toEqual([]);
    expect(filterVisibleVideos([video("back")], date).map((v) => v.id)).toEqual(["back"]);
  });

  test.each([filterVisibleVideos, visibleVideosBySecond])(
    "reuses results for the same array and timestamp",
    (compute) => {
      const videos = [video("same")];
      const first = compute(videos, date);
      expect(compute(videos, new Date(date))).toBe(first);
      compute([video("other")], date);
      expect(compute(videos, new Date(date))).toBe(first);
    }
  );

  test("includes the date in second-map and day-filter cache lookups", () => {
    const videos = [video("two-days", 86399, 86401)];
    const nextDate = new Date("2024-07-02T00:00:00Z");
    expect(visibleVideosBySecond(videos, date).get("86399/0")).toEqual(["two-days"]);
    expect(visibleVideosBySecond(videos, nextDate).get("0/0")).toEqual(["two-days"]);
    const withinDay = [video("only-first")];
    expect(filterVisibleVideos(withinDay, date)).toEqual(withinDay);
    expect(filterVisibleVideos(withinDay, nextDate)).toEqual([]);
    expect(filterVisibleVideos(withinDay, date)).toEqual(withinDay);
  });

  test("recomputes the selected player after a same-length source change", () => {
    const select = (videoFiles: VideoFile[]) =>
      determineVideoPlayerType({
        downlinkNumber: 1,
        mtxPlaybackRecordsForDownlink: undefined,
        videos: {
          videoFiles,
          mtxHlsEndpoints: [],
          mtxPlaybackAvailability: {},
          metadataIo: null,
          metadataMtx: null,
        },
        date: date.toISOString(),
        appSeconds: 10,
        source: "ISS",
      });
    expect(select([video("first", 10, 12, 0)])).toBe("IO");
    expect(select([video("other-channel", 10, 12, 1)])).toBe("NONE");
    expect(select([video("replacement", 10, 12, 0)])).toBe("IO");
  });

  test("channel availability uses the current second map", () => {
    visibleVideosBySecond([video("first", 10, 12, 0)], date);
    const mapping = visibleVideosBySecond([video("second", 10, 12, 2)], date);
    expect(
      calculateChannelAvailability(date.toISOString(), 10, mapping, {}, [], "ISS", false)
    ).toEqual([false, false, true, false, false, false, false, false]);
  });

  test("supports frozen inputs without changing their contents", () => {
    const videos = [video("immutable")];
    Object.freeze(videos[0]);
    Object.freeze(videos);
    expect(filterVisibleVideos(videos, date)).toEqual(videos);
    expect(visibleVideosBySecond(videos, date).get("10/0")).toEqual(["immutable"]);
    expect(videos[0].start).toBe(epoch + 10);
  });

  test("empty lists retain empty results", () => {
    expect(filterVisibleVideos([], date)).toEqual([]);
    expect(visibleVideosBySecond([], date).size).toBe(0);
  });
});
