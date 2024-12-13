export function calcMTXRecordingsTimeRanges(data: MtxPathRecording): MtxRecordingTimeRange[] {
  const segments = data.segments;
  const timeRanges: MtxRecordingTimeRange[] = [];

  if (segments.length === 0) {
    return timeRanges;
  }

  const expectedInterval = calculateVideoSegmentInterval(data);
  const margin = 10; // +- 10 seconds

  let currentRangeStart = segments[0].start;

  let cumulativeDuration = 0;
  for (let i = 1; i < segments.length; i++) {
    const prevSegmentStart = segments[i - 1].start;
    const currentSegmentStart = segments[i].start;

    const prevTime = new Date(prevSegmentStart).getTime();
    const currentTime = new Date(currentSegmentStart).getTime();

    const intervalInSeconds = (currentTime - prevTime) / 1000;
    const lowerBound = expectedInterval - margin;
    const upperBound = expectedInterval + margin;

    if (intervalInSeconds >= lowerBound && intervalInSeconds <= upperBound) {
      cumulativeDuration += currentTime - prevTime;
      continue;
    } else {
      // assume the segment before the disruption is half the expected interval
      cumulativeDuration += (expectedInterval / 2) * 1000;

      // End current time range
      const durationInSeconds = cumulativeDuration / 1000;

      if (durationInSeconds > 0) {
        timeRanges.push({
          start: currentRangeStart,
          duration: durationInSeconds,
        });
      }

      // Start new time range
      currentRangeStart = currentSegmentStart;
      cumulativeDuration = 0;
    }
  }

  // assume the segment before the disruption is half the expected interval
  cumulativeDuration += (expectedInterval / 2) * 1000;

  // Add the last time range
  const durationInSeconds = cumulativeDuration / 1000;

  if (durationInSeconds > 0) {
    timeRanges.push({
      start: currentRangeStart,
      duration: durationInSeconds,
    });
  }

  return timeRanges;
}

/**
 * Take an MtxPathRecording that contains a list of video segments with start times that are expected to be continuous and calculate the most common segment length
 * @param data
 * @returns most common segment length in seconds
 */
export function calculateVideoSegmentInterval(data: MtxPathRecording): number {
  const segments = data.segments;
  if (segments.length === 1) return 150; // one partial segment assumed to be 2.5 minutes
  if (segments.length === 0) return 0;

  const startTimes: number[] = segments.map((segment) => new Date(segment.start).getTime());

  const timeDifferences: number[] = [];
  for (let i = 1; i < startTimes.length; i++) {
    const diffInSeconds = (startTimes[i] - startTimes[i - 1]) / 1000;
    timeDifferences.push(diffInSeconds);
  }

  // Create a histogram of time differences
  const histogram: { [key: number]: number } = {};
  timeDifferences.forEach((diff) => {
    const roundedDiff = Math.round(diff / 5) * 5; // Round to nearest 5 seconds
    histogram[roundedDiff] = (histogram[roundedDiff] || 0) + 1;
  });

  // Find the mode of the time differences
  let expectedSegmentLength = 0;
  let maxCount = 0;
  for (const [diffStr, count] of Object.entries(histogram)) {
    const diff = parseInt(diffStr);
    if (count > maxCount) {
      maxCount = count;
      expectedSegmentLength = diff;
    }
  }

  return expectedSegmentLength;
}
