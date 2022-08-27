/**
 * Fetch override video manifest from the override location specified in the wiki
 */
export async function getVideoManifest(override: VideoSourceOverride): Promise<OverrideVideo[]> {
  const dataPath = `${override.url}/videoManifest.json`;

  let res: Response;
  try {
    res = await fetch(dataPath);
  } catch (e) {
    throw e;
  }
  return res.json();
}

/**
 * Convert overrideVideo[] videoFile[]
 */
export function convertOverrideVideosToVideoFiles(
  oVideos: OverrideVideo[],
  override: VideoSourceOverride
): VideoFile[] {
  const videos: VideoFile[] = oVideos.map((oVideo) => {
    // Create array of date elements from creation date
    const dateToUse = oVideo.dateTime;
    let dateArr = dateToUse
      // regex match for the date
      .match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z/)
      // remove the first item (the full matched string)
      .slice(1)
      .map((n: string) => parseInt(n));

    // create date object. Note, month is 0-11 in javascript.
    const UTCstartMilliseconds = Date.UTC(
      dateArr[0],
      dateArr[1] - 1,
      dateArr[2],
      dateArr[3],
      dateArr[4],
      dateArr[5]
    );
    const duration_ms = oVideo.durationSeconds * 1000;
    const UTCend = new Date(UTCstartMilliseconds + duration_ms);

    const video: VideoFile = {
      id: oVideo.filename,
      title: oVideo.filename,
      downlink: oVideo.downlink - 1, // base 0 index
      startDateTime: oVideo.dateTime,
      start: UTCstartMilliseconds / 1000,
      end: UTCend.valueOf() / 1000,
      mediaLowResURL: `${override.url}/video/${oVideo.filename}`,
      priority: 1,
      LOS: false,
      description: oVideo.filename,
      collection: "",
      collections: "",
      dataURL: "",
    };
    return video;
  });
  return videos;
}
