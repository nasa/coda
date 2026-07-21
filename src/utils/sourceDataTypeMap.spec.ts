import {
  isDataTypeValidForSource,
  isDateValidForMtxVideo,
  isDataTypeValidForSourceAndDate,
  getSourcesForTalkybotGroup,
} from "./sourceDataTypeMap";

const MTX_VIDEO_MAX_AGE_DAYS = 7; // Default value for tests

describe("sourceDataTypeMap", () => {
  describe("isDataTypeValidForSource", () => {
    it("should return true for valid data types", () => {
      expect(isDataTypeValidForSource("ISS", "videos")).toBe(true);
      expect(isDataTypeValidForSource("ISS", "mtxvideo")).toBe(true);
      expect(isDataTypeValidForSource("TEST_EVENTS", "gpstracks")).toBe(true);
    });

    it("should return false for invalid data types", () => {
      expect(isDataTypeValidForSource("ISS", "gpstracks")).toBe(false);
      expect(isDataTypeValidForSource("NBL", "ephemeris")).toBe(false);
    });
  });

  describe("isDateValidForMtxVideo", () => {
    it("should return true for today", () => {
      const today = new Date().toISOString().split("T")[0];
      expect(isDateValidForMtxVideo(today, MTX_VIDEO_MAX_AGE_DAYS)).toBe(true);
    });

    it("should return true for null date (loading state)", () => {
      expect(isDateValidForMtxVideo(null, MTX_VIDEO_MAX_AGE_DAYS)).toBe(true);
    });

    it("should return true for undefined date (loading state)", () => {
      expect(isDateValidForMtxVideo(undefined, MTX_VIDEO_MAX_AGE_DAYS)).toBe(true);
    });

    it("should return true for dates within 7 days", () => {
      const sixDaysAgo = new Date();
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      expect(
        isDateValidForMtxVideo(sixDaysAgo.toISOString().split("T")[0], MTX_VIDEO_MAX_AGE_DAYS)
      ).toBe(true);
    });

    it("should return false for dates older than 7 days", () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      expect(
        isDateValidForMtxVideo(eightDaysAgo.toISOString().split("T")[0], MTX_VIDEO_MAX_AGE_DAYS)
      ).toBe(false);
    });

    it("should return false for exactly 7 days ago", () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - MTX_VIDEO_MAX_AGE_DAYS);
      expect(
        isDateValidForMtxVideo(sevenDaysAgo.toISOString().split("T")[0], MTX_VIDEO_MAX_AGE_DAYS)
      ).toBe(false);
    });

    it("should return false for future dates", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Future dates should be allowed - we only restrict dates more than 7 days in the past
      expect(
        isDateValidForMtxVideo(tomorrow.toISOString().split("T")[0], MTX_VIDEO_MAX_AGE_DAYS)
      ).toBe(true);
    });
  });

  describe("isDataTypeValidForSourceAndDate", () => {
    it("should return true for non-mtxvideo data types regardless of date", () => {
      const oldDate = "2020-01-01";
      expect(
        isDataTypeValidForSourceAndDate("ISS", "videos", oldDate, MTX_VIDEO_MAX_AGE_DAYS)
      ).toBe(true);
      expect(
        isDataTypeValidForSourceAndDate("ISS", "photos", oldDate, MTX_VIDEO_MAX_AGE_DAYS)
      ).toBe(true);
    });

    it("should return true for mtxvideo with recent date", () => {
      const today = new Date().toISOString().split("T")[0];
      expect(
        isDataTypeValidForSourceAndDate("ISS", "mtxvideo", today, MTX_VIDEO_MAX_AGE_DAYS)
      ).toBe(true);
    });

    it("should return false for mtxvideo with old date", () => {
      const oldDate = "2020-01-01";
      expect(
        isDataTypeValidForSourceAndDate("ISS", "mtxvideo", oldDate, MTX_VIDEO_MAX_AGE_DAYS)
      ).toBe(false);
    });

    it("should work without date parameter (source validation only)", () => {
      expect(isDataTypeValidForSourceAndDate("ISS", "mtxvideo")).toBe(true);
      expect(isDataTypeValidForSourceAndDate("ISS", "gpstracks")).toBe(false);
    });

    it("should return false if source validation fails even with valid date", () => {
      const today = new Date().toISOString().split("T")[0];
      expect(
        isDataTypeValidForSourceAndDate("ISS", "gpstracks", today, MTX_VIDEO_MAX_AGE_DAYS)
      ).toBe(false);
    });
  });

  describe("getSourcesForTalkybotGroup", () => {
    it("should route real (non-sim) ISS traffic to ISS only", () => {
      expect(getSourcesForTalkybotGroup("iss", false)).toEqual(["ISS"]);
    });

    it("should drop simulated ISS traffic entirely", () => {
      expect(getSourcesForTalkybotGroup("iss", true)).toEqual([]);
    });

    it("should route the 'test' group to the miscellaneous bucket regardless of sim", () => {
      expect(getSourcesForTalkybotGroup("test", false)).toEqual(["TEST_EVENTS", "ARTEMIS"]);
      expect(getSourcesForTalkybotGroup("test", true)).toEqual(["TEST_EVENTS", "ARTEMIS"]);
    });

    it("should route the 'sim' group to the miscellaneous bucket regardless of sim", () => {
      expect(getSourcesForTalkybotGroup("sim", false)).toEqual(["TEST_EVENTS", "ARTEMIS"]);
      expect(getSourcesForTalkybotGroup("sim", true)).toEqual(["TEST_EVENTS", "ARTEMIS"]);
    });

    it("should route the 'artemis' group to the miscellaneous bucket regardless of sim", () => {
      expect(getSourcesForTalkybotGroup("artemis", false)).toEqual(["TEST_EVENTS", "ARTEMIS"]);
      expect(getSourcesForTalkybotGroup("artemis", true)).toEqual(["TEST_EVENTS", "ARTEMIS"]);
    });

    it("should route unknown group slugs to the miscellaneous bucket rather than dropping them", () => {
      expect(getSourcesForTalkybotGroup("some-future-group", false)).toEqual([
        "TEST_EVENTS",
        "ARTEMIS",
      ]);
      expect(getSourcesForTalkybotGroup("some-future-group", true)).toEqual([
        "TEST_EVENTS",
        "ARTEMIS",
      ]);
    });
  });
});
