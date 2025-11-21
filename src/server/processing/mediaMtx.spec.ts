import { adjustPlaybackRangesForDay } from "./mediaMtx";

describe("mediaMtx", () => {
  describe("adjustPlaybackRangesForDay", () => {
    const testDate = "2025-01-15";

    it("should keep records that start and end within the same day", () => {
      const mtxPlaybackAvailability: MTXPlaybackAvailability = {
        "1": [
          {
            start: "2025-01-15T10:00:00.000Z",
            duration: 3600, // 1 hour
          },
          {
            start: "2025-01-15T14:30:00.000Z",
            duration: 7200, // 2 hours
          },
        ],
      };

      const result = adjustPlaybackRangesForDay({
        mtxPlaybackAvailability,
        dateWanted: testDate,
      });

      expect(result["1"]).toHaveLength(2);
      expect(result["1"][0]).toEqual({
        start: "2025-01-15T10:00:00.000Z",
        duration: 3600,
      });
      expect(result["1"][1]).toEqual({
        start: "2025-01-15T14:30:00.000Z",
        duration: 7200,
      });
    });

    it("should exclude records that end before the day starts", () => {
      const mtxPlaybackAvailability: MTXPlaybackAvailability = {
        "1": [
          {
            start: "2025-01-14T20:00:00.000Z",
            duration: 7200, // 2 hours, ends at 22:00 on Jan 14
          },
        ],
      };

      const result = adjustPlaybackRangesForDay({
        mtxPlaybackAvailability,
        dateWanted: testDate,
      });

      expect(result["1"]).toEqual([]);
    });

    it("should adjust records that start before the day and end during the day", () => {
      const mtxPlaybackAvailability: MTXPlaybackAvailability = {
        "1": [
          {
            start: "2025-01-14T22:00:00.000Z", // 2 hours before day start
            duration: 10800, // 3 hours total, ends 1 hour into the day
          },
        ],
      };

      const result = adjustPlaybackRangesForDay({
        mtxPlaybackAvailability,
        dateWanted: testDate,
      });

      expect(result["1"]).toHaveLength(1);
      expect(result["1"][0].start).toBe("2025-01-15T00:00:00.000Z");
      expect(result["1"][0].duration).toBe(3600); // Only 1 hour remains
    });

    it("should adjust records that span the entire day", () => {
      const mtxPlaybackAvailability: MTXPlaybackAvailability = {
        "1": [
          {
            start: "2025-01-14T20:00:00.000Z", // 4 hours before day start
            duration: 115200, // 32 hours total
          },
        ],
      };

      const result = adjustPlaybackRangesForDay({
        mtxPlaybackAvailability,
        dateWanted: testDate,
      });

      expect(result["1"]).toHaveLength(1);
      expect(result["1"][0].start).toBe("2025-01-15T00:00:00.000Z");
      expect(result["1"][0].duration).toBe(86400); // Capped at 24 hours
    });

    it("should handle multiple channels with various edge cases", () => {
      const mtxPlaybackAvailability: MTXPlaybackAvailability = {
        "1": [
          {
            start: "2025-01-15T10:00:00.000Z",
            duration: 3600,
          },
        ],
        "2": [
          {
            start: "2025-01-14T23:00:00.000Z",
            duration: 7200, // 2 hours, crosses midnight
          },
        ],
        "3": [
          {
            start: "2025-01-14T20:00:00.000Z",
            duration: 3600, // Ends before day starts
          },
        ],
        "4": [
          {
            start: "2025-01-14T12:00:00.000Z",
            duration: 172800, // 48 hours, spans multiple days
          },
        ],
      };

      const result = adjustPlaybackRangesForDay({
        mtxPlaybackAvailability,
        dateWanted: testDate,
      });

      // Channel 1: Normal record within the day
      expect(result["1"]).toHaveLength(1);
      expect(result["1"][0].start).toBe("2025-01-15T10:00:00.000Z");
      expect(result["1"][0].duration).toBe(3600);

      // Channel 2: Crosses midnight, adjusted to start at day boundary
      expect(result["2"]).toHaveLength(1);
      expect(result["2"][0].start).toBe("2025-01-15T00:00:00.000Z");
      expect(result["2"][0].duration).toBe(3600); // 1 hour remains in the day

      // Channel 3: Ends before day starts, excluded
      expect(result["3"]).toEqual([]);

      // Channel 4: Spans the entire day, capped at 24 hours
      expect(result["4"]).toHaveLength(1);
      expect(result["4"][0].start).toBe("2025-01-15T00:00:00.000Z");
      expect(result["4"][0].duration).toBe(86400);
    });
  });
});
