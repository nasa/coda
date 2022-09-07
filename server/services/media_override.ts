import { appSecondsFromDateString } from "utils/formatting";

/**
 * Fetch override video manifest from the override location specified in the wiki
 */
export async function getManifest(
  override: MediaSourceOverride
): Promise<OverrideVideo[] | OverridePhoto[]> {
  const dataPath = `${override.url}/${override.type}Manifest.json`;

  let res: Response;
  try {
    res = await fetch(dataPath);
  } catch (e) {
    throw e;
  }
  return res.json();
}

/**
 * Convert overrideVideo[] to videoFile[]
 */
export function convertOverrideVideosToVideoFiles(
  oVideos: OverrideVideo[],
  override: MediaSourceOverride
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

/**
 *  Convert overridePhoto[] to photoFile[]
 */
export function convertOverridePhotosToPhotoFiles(
  oPhotos: OverridePhoto[],
  override: MediaSourceOverride
): PhotoFile[] {
  const photos: PhotoFile[] = oPhotos.map((oPhoto) => {
    const photo: PhotoFile = {
      id: oPhoto.filenameRoot,
      title: oPhoto.filenameRoot,
      dateAdded: oPhoto.dateTimeOriginal,
      datetimeTaken: oPhoto.dateTimeOriginal,
      datetimeTakenAppSeconds: appSecondsFromDateString(oPhoto.dateTimeOriginal),
      mediaLowResURL: `${override.url}/photo/${oPhoto.directory}/lores/${oPhoto.filenameRoot}.jpg`,
      mediaHighResURL: `${override.url}/photo/${oPhoto.directory}/hires/${oPhoto.filenameRoot}.png`,
      mediaThumbURL: `${override.url}/photo/${oPhoto.directory}/thumb/${oPhoto.filenameRoot}.jpg`,
      description: oPhoto.filenameRoot,
      collection: "",
      collections: "",
      dataURL: "",
    };
    return photo;
  });
  return photos;
}
