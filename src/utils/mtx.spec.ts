// calcMTXRecordingsTimeRanges.test.js

import { calcMTXRecordingsTimeRanges, calculateVideoSegmentInterval } from "./mtx";

describe("calcMTXRecordingsTimeRanges", () => {
  it("should correctly calculate time ranges from segments", () => {
    const data = {
      name: "TestRecording",
      segments: [
        { start: "2024-11-11T10:00:00.000Z" },
        { start: "2024-11-11T10:05:00.000Z" },
        { start: "2024-11-11T10:10:00.000Z" },
        // Disruption here
        { start: "2024-11-11T10:20:00.000Z" },
        { start: "2024-11-11T10:25:00.000Z" },
      ],
    };

    const expectedOutput = [
      {
        start: "2024-11-11T10:00:00.000Z",
        duration: 300 * 2 + 150, // 2 segments plus 2.5 minutes for a partial segment
      },
      {
        start: "2024-11-11T10:20:00.000Z",
        duration: 300 + 150, // 1 segment plus 2.5 minutes for a partial segment
      },
    ];

    const result = calcMTXRecordingsTimeRanges(data);

    expect(result).toEqual(expectedOutput);
  });

  it("should handle a single segment", () => {
    const data = {
      name: "TestRecording",
      segments: [{ start: "2024-11-11T12:00:00.000Z" }],
    };

    const expectedOutput = [
      {
        start: "2024-11-11T12:00:00.000Z",
        duration: 75, // half the length of the default assumed segment length in calculateVideoSegmentInterval
      },
    ];

    const result = calcMTXRecordingsTimeRanges(data);

    expect(result).toEqual(expectedOutput);
  });

  it("should return an empty array when no segments are provided", () => {
    const data: MtxPathRecording = {
      name: "TestRecording",
      segments: [],
    };

    const expectedOutput: MtxRecordingTimeRange[] = [];

    const result = calcMTXRecordingsTimeRanges(data);

    expect(result).toEqual(expectedOutput);
  });
});

describe("calculateVideoSegmentLength", () => {
  it("should return the segment length for evenly spaced segments", () => {
    const data: MtxPathRecording = {
      name: "Test_Evenly_Spaced",
      segments: [
        { start: "2024-11-13T16:00:00.000Z" },
        { start: "2024-11-13T16:05:00.000Z" },
        { start: "2024-11-13T16:10:00.000Z" },
        { start: "2024-11-13T16:15:00.000Z" },
      ],
    };

    const expectedSegmentLength = 300; // 5 minutes in seconds
    const result = calculateVideoSegmentInterval(data);
    expect(result).toBe(expectedSegmentLength);
  });

  it("should return the most common segment length when there are breaks", () => {
    const data: MtxPathRecording = {
      name: "Test_With_Breaks",
      segments: [
        { start: "2024-11-13T16:00:00.000Z" },
        { start: "2024-11-13T16:05:00.000Z" }, // 5 minutes
        { start: "2024-11-13T16:10:00.000Z" }, // 5 minutes
        // Break of 30 minutes
        { start: "2024-11-13T16:40:00.000Z" },
        { start: "2024-11-13T16:45:00.000Z" }, // 5 minutes
        { start: "2024-11-13T16:50:00.000Z" }, // 5 minutes
      ],
    };

    const expectedSegmentLength = 300; // 5 minutes in seconds
    const result = calculateVideoSegmentInterval(data);
    expect(result).toBe(expectedSegmentLength);
  });

  it("should return the most common segment length when intervals vary slightly", () => {
    const data: MtxPathRecording = {
      name: "Test_Slight_Variations",
      segments: [
        { start: "2024-11-13T16:00:00.000Z" },
        { start: "2024-11-13T16:05:02.000Z" }, // 5 minutes 2 seconds
        { start: "2024-11-13T16:10:01.000Z" }, // 4 minutes 59 seconds
        { start: "2024-11-13T16:15:03.000Z" }, // 5 minutes 2 seconds
      ],
    };

    const expectedSegmentLength = 300; // After rounding differences, 5 minutes
    const result = calculateVideoSegmentInterval(data);
    expect(result).toBe(expectedSegmentLength);
  });

  it("should handle segments with multiple common intervals", () => {
    const data: MtxPathRecording = {
      name: "Test_Multiple_Common_Intervals",
      segments: [
        { start: "2024-11-13T16:00:00.000Z" },
        { start: "2024-11-13T16:06:00.000Z" }, // 6 minutes
        { start: "2024-11-13T16:11:00.000Z" }, // 5 minutes
        { start: "2024-11-13T16:17:00.000Z" }, // 6 minutes
        { start: "2024-11-13T16:22:00.000Z" }, // 5 minutes
      ],
    };

    // After rounding to nearest 5 seconds, intervals are:
    // 360 seconds (6 minutes), 300 seconds (5 minutes), 360 seconds, 300 seconds
    // Both 300 and 360 occur twice
    // The function should pick the smallest interval in case of a tie
    const expectedSegmentLength = 300;
    const result = calculateVideoSegmentInterval(data);
    expect(result).toBe(expectedSegmentLength);
  });

  it("should return 2.5 minutes when there is only one segment", () => {
    const data: MtxPathRecording = {
      name: "Test_Single_Segment",
      segments: [{ start: "2024-11-13T16:00:00.000Z" }],
    };

    const expectedSegmentLength = 150;
    const result = calculateVideoSegmentInterval(data);
    expect(result).toBe(expectedSegmentLength);
  });

  it("should return zero when there are no segments", () => {
    const data: MtxPathRecording = {
      name: "Test_No_Segments",
      segments: [],
    };

    const expectedSegmentLength = 0;
    const result = calculateVideoSegmentInterval(data);
    expect(result).toBe(expectedSegmentLength);
  });

  it("should correctly handle outliers in segment intervals", () => {
    const data: MtxPathRecording = {
      name: "Test_Outliers",
      segments: [
        { start: "2024-11-13T16:00:00.000Z" },
        { start: "2024-11-13T16:05:00.000Z" }, // 5 minutes
        { start: "2024-11-13T16:10:00.000Z" }, // 5 minutes
        { start: "2024-11-13T16:50:00.000Z" }, // 40 minutes (outlier)
        { start: "2024-11-13T16:55:00.000Z" }, // 5 minutes
        { start: "2024-11-13T17:00:00.000Z" }, // 5 minutes
      ],
    };

    const expectedSegmentLength = 300; // 5 minutes
    const result = calculateVideoSegmentInterval(data);
    expect(result).toBe(expectedSegmentLength);
  });

  it("should handle segments with non-uniform intervals", () => {
    const data: MtxPathRecording = {
      name: "Test_Non_Uniform_Intervals",
      segments: [
        { start: "2024-11-13T16:00:00.000Z" },
        { start: "2024-11-13T16:03:00.000Z" }, // 3 minutes
        { start: "2024-11-13T16:06:00.000Z" }, // 3 minutes
        { start: "2024-11-13T16:10:00.000Z" }, // 4 minutes
        { start: "2024-11-13T16:13:00.000Z" }, // 3 minutes
        { start: "2024-11-13T16:16:00.000Z" }, // 3 minutes
      ],
    };

    // Intervals are: 180, 180, 240, 180, 180
    // Rounded intervals: 180, 180, 240, 180, 180
    // Counts: 180s occurs 4 times, 240s occurs once
    const expectedSegmentLength = 180; // 3 minutes
    const result = calculateVideoSegmentInterval(data);
    expect(result).toBe(expectedSegmentLength);
  });

  it("should handle cases where the most common interval is not the shortest", () => {
    const data: MtxPathRecording = {
      name: "Test_Most_Common_Not_Shortest",
      segments: [
        { start: "2024-11-13T16:00:00.000Z" },
        { start: "2024-11-13T16:10:00.000Z" }, // 10 minutes
        { start: "2024-11-13T16:15:00.000Z" }, // 5 minutes
        { start: "2024-11-13T16:25:00.000Z" }, // 10 minutes
        { start: "2024-11-13T16:35:00.000Z" }, // 10 minutes
      ],
    };

    // Intervals: 600, 300, 600, 600
    // Rounded intervals: 600, 300, 600, 600
    // Counts: 600s occurs 3 times, 300s occurs once
    const expectedSegmentLength = 600; // 10 minutes
    const result = calculateVideoSegmentInterval(data);
    expect(result).toBe(expectedSegmentLength);
  });
});
