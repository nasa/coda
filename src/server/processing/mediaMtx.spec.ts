import {
  adjustPlaybackRangesForDay,
  MAX_SEGMENT_GAP_SECONDS,
  mergeConsecutiveSegments,
} from "./mediaMtx";

describe("mediaMtx", () => {
  describe("mergeConsecutiveSegments", () => {
    it("should return empty array for empty input", () => {
      expect(mergeConsecutiveSegments([])).toEqual([]);
      expect(mergeConsecutiveSegments(null as unknown as MTXRecordingTimeRange[])).toEqual([]);
    });

    it("should return single segment unchanged", () => {
      const segments: MTXRecordingTimeRange[] = [
        { start: "2025-01-15T10:00:00.000Z", duration: 90 },
      ];
      const result = mergeConsecutiveSegments(segments);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: "2025-01-15T10:00:00.000Z", duration: 90 });
    });

    it(`should merge consecutive segments with small gaps (< ${MAX_SEGMENT_GAP_SECONDS} seconds)`, () => {
      const segments: MTXRecordingTimeRange[] = [
        { start: "2025-01-15T10:00:00.000Z", duration: 90 }, // ends at 10:01:30
        { start: "2025-01-15T10:01:40.000Z", duration: 90 }, // starts 10 seconds after previous ends
      ];
      const result = mergeConsecutiveSegments(segments);
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe("2025-01-15T10:00:00.000Z");
      // Duration should be from start to end of second segment: 3 min 10 sec = 190 seconds
      expect(result[0].duration).toBe(190);
    });

    it("should merge exactly touching segments (0 gap)", () => {
      const segments: MTXRecordingTimeRange[] = [
        { start: "2025-01-15T10:00:00.000Z", duration: 90 }, // ends at 10:01:30
        { start: "2025-01-15T10:01:30.000Z", duration: 90 }, // starts exactly when previous ends
      ];
      const result = mergeConsecutiveSegments(segments);
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe("2025-01-15T10:00:00.000Z");
      expect(result[0].duration).toBe(180); // Combined duration
    });

    it(`should NOT merge segments with large gaps (> ${MAX_SEGMENT_GAP_SECONDS} seconds)`, () => {
      const segments: MTXRecordingTimeRange[] = [
        { start: "2025-01-15T10:00:00.000Z", duration: 90 }, // ends at 10:01:30
        { start: "2025-01-15T10:01:50.000Z", duration: 90 }, // starts 20 seconds after previous ends
      ];
      const result = mergeConsecutiveSegments(segments);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ start: "2025-01-15T10:00:00.000Z", duration: 90 });
      expect(result[1]).toEqual({ start: "2025-01-15T10:01:50.000Z", duration: 90 });
    });

    it("should handle overlapping segments by merging them", () => {
      const segments: MTXRecordingTimeRange[] = [
        { start: "2025-01-15T10:00:00.000Z", duration: 100 }, // ends at 10:01:40
        { start: "2025-01-15T10:01:30.000Z", duration: 90 }, // starts 10 seconds before previous ends
      ];
      const result = mergeConsecutiveSegments(segments);
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe("2025-01-15T10:00:00.000Z");
      // Duration should extend to end of second segment: 10:00:00 to 10:03:00 = 180 seconds
      expect(result[0].duration).toBe(180);
    });

    it("should sort and merge out-of-order segments", () => {
      // Third segment gap exceeds MAX_SEGMENT_GAP_SECONDS
      const gapExceedingThreshold = MAX_SEGMENT_GAP_SECONDS + 7; // 22 seconds with default 15s threshold
      const thirdSegmentStart = new Date("2025-01-15T10:02:58.000Z");
      thirdSegmentStart.setSeconds(thirdSegmentStart.getSeconds() + gapExceedingThreshold);

      const segments: MTXRecordingTimeRange[] = [
        { start: thirdSegmentStart.toISOString(), duration: 90 }, // Third segment
        { start: "2025-01-15T10:00:00.000Z", duration: 88 }, // First segment (ends at 10:01:28)
        { start: "2025-01-15T10:01:30.000Z", duration: 88 }, // Second segment (starts 2s after first ends, ends at 10:02:58)
      ];
      const result = mergeConsecutiveSegments(segments);
      // First two should merge (2s gap), third is separate (gap exceeds threshold)
      expect(result).toHaveLength(2);
      expect(result[0].start).toBe("2025-01-15T10:00:00.000Z");
      expect(result[0].duration).toBe(178); // From 10:00:00 to 10:02:58
      expect(result[1].start).toBe(thirdSegmentStart.toISOString());
      expect(result[1].duration).toBe(90);
    });

    it("should merge multiple consecutive segments into one", () => {
      const segments: MTXRecordingTimeRange[] = [
        { start: "2025-01-15T10:00:00.000Z", duration: 90 }, // ends at 10:01:30
        { start: "2025-01-15T10:01:32.000Z", duration: 90 }, // ends at 10:03:02, gap of 2s
        { start: "2025-01-15T10:03:04.000Z", duration: 90 }, // ends at 10:04:34, gap of 2s
        { start: "2025-01-15T10:04:36.000Z", duration: 90 }, // ends at 10:06:06, gap of 2s
      ];
      const result = mergeConsecutiveSegments(segments);
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe("2025-01-15T10:00:00.000Z");
      // Duration from 10:00:00 to 10:06:06 = 366 seconds
      expect(result[0].duration).toBe(366);
    });

    it(`should handle boundary case of exactly ${MAX_SEGMENT_GAP_SECONDS} second gap (merge)`, () => {
      // Create segment that starts exactly MAX_SEGMENT_GAP_SECONDS after previous ends
      const firstSegmentEnd = new Date("2025-01-15T10:01:30.000Z");
      const secondSegmentStart = new Date(
        firstSegmentEnd.getTime() + MAX_SEGMENT_GAP_SECONDS * 1000
      );

      const segments: MTXRecordingTimeRange[] = [
        { start: "2025-01-15T10:00:00.000Z", duration: 90 }, // ends at 10:01:30
        { start: secondSegmentStart.toISOString(), duration: 90 },
      ];
      const result = mergeConsecutiveSegments(segments);
      expect(result).toHaveLength(1);
      // Duration from 10:00:00 to end of second segment
      const expectedDuration = 90 + MAX_SEGMENT_GAP_SECONDS + 90;
      expect(result[0].duration).toBe(expectedDuration);
    });

    it(`should handle boundary case of just over ${MAX_SEGMENT_GAP_SECONDS} second gap (don't merge)`, () => {
      // Create segment that starts just over MAX_SEGMENT_GAP_SECONDS after previous ends
      const firstSegmentEnd = new Date("2025-01-15T10:01:30.000Z");
      const secondSegmentStart = new Date(
        firstSegmentEnd.getTime() + MAX_SEGMENT_GAP_SECONDS * 1000 + 1
      );

      const segments: MTXRecordingTimeRange[] = [
        { start: "2025-01-15T10:00:00.000Z", duration: 90 }, // ends at 10:01:30
        { start: secondSegmentStart.toISOString(), duration: 90 },
      ];
      const result = mergeConsecutiveSegments(segments);
      expect(result).toHaveLength(2);
    });

    it("should handle segments with fractional durations", () => {
      const segments: MTXRecordingTimeRange[] = [
        { start: "2025-01-15T10:00:00.000Z", duration: 88.5 },
        { start: "2025-01-15T10:01:30.000Z", duration: 89.2 }, // starts 1.5s after previous ends
      ];
      const result = mergeConsecutiveSegments(segments);
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe("2025-01-15T10:00:00.000Z");
      // Duration from 10:00:00 to 10:02:59.2 = 179.2 seconds
      expect(result[0].duration).toBeCloseTo(179.2, 1);
    });
  });

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
