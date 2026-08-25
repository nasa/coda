import {
  isCanonicalDate,
  resolveApplicableMediaOverrides,
  validateMediaOverrideUrl,
} from "./mediaOverrideResolver";

const override = (
  id: number,
  date: string,
  matchMode: MediaOverrideMatchMode,
  url = "https://media.example.test/{date}"
): MediaOverride => ({
  id,
  date,
  source: "TEST_EVENTS",
  type: "video",
  matchMode,
  url: matchMode === "exact" ? url.replace("{date}", date) : url,
  accessGrantId: null,
});

describe("resolveApplicableMediaOverrides", () => {
  it("does not apply a daily override before its start date", () => {
    expect(
      resolveApplicableMediaOverrides([override(1, "2026-08-14", "daily")], "2026-08-13")
    ).toEqual([]);
  });

  it("applies a daily override on its start date and resolves the date token", () => {
    const result = resolveApplicableMediaOverrides(
      [override(1, "2026-08-14", "daily")],
      "2026-08-14"
    );

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://media.example.test/2026-08-14");
  });

  it("resolves a later requested date rather than the configured start date", () => {
    const result = resolveApplicableMediaOverrides(
      [override(1, "2026-08-14", "daily")],
      "2026-08-25"
    );

    expect(result[0].url).toBe("https://media.example.test/2026-08-25");
  });

  it("prefers exact overrides over active daily overrides", () => {
    const candidates = [
      override(1, "2026-08-01", "daily"),
      override(2, "2026-08-25", "exact", "https://special.example.test/{date}"),
    ];

    expect(resolveApplicableMediaOverrides(candidates, "2026-08-25")).toEqual([candidates[1]]);
  });

  it("uses only the newest applicable daily generation", () => {
    const candidates = [
      override(1, "2026-08-01", "daily", "https://old.example.test/{date}"),
      override(2, "2026-08-20", "daily", "https://new.example.test/{date}"),
      override(3, "2026-08-20", "daily", "https://new-2.example.test/{date}"),
    ];

    expect(
      resolveApplicableMediaOverrides(candidates, "2026-08-25").map((item) => item.url)
    ).toEqual(["https://new.example.test/2026-08-25", "https://new-2.example.test/2026-08-25"]);
  });
});

describe("media override validation", () => {
  it("validates real canonical calendar dates", () => {
    expect(isCanonicalDate("2026-08-25")).toBe(true);
    expect(isCanonicalDate("2026-02-30")).toBe(false);
    expect(isCanonicalDate("2026/08/25")).toBe(false);
  });

  it("requires exactly one date token for daily templates", () => {
    expect(validateMediaOverrideUrl("https://example.test/{date}", "daily")).toBeNull();
    expect(validateMediaOverrideUrl("https://example.test/static", "daily")).not.toBeNull();
    expect(validateMediaOverrideUrl("https://example.test/{date}/{date}", "daily")).not.toBeNull();
  });

  it("rejects date tokens in exact URLs and unknown template tokens", () => {
    expect(validateMediaOverrideUrl("https://example.test/{date}", "exact")).not.toBeNull();
    expect(validateMediaOverrideUrl("https://example.test/{mission}", "daily")).not.toBeNull();
  });

  it("rejects non-http URLs and embedded credentials", () => {
    expect(validateMediaOverrideUrl("file:///tmp/{date}", "daily")).not.toBeNull();
    expect(
      validateMediaOverrideUrl("https://user:pass@example.test/{date}", "daily")
    ).not.toBeNull();
  });
});
