import { Collection, PhotoFile, VideoFile } from "typings/index.d";
import type { AncillaryDataRaw, AncillaryPayload } from "typings/ancillary";
import { appSecondsFromDateString } from "utils/formatting";

export async function getAncillaryDataPayload(
  year: number,
  month: number,
  date: number,
  eventType: string
): Promise<AncillaryPayload> {
  const res = await fetch(
    `/api/ancillary/getAncillaryData?year=${year}&month=${month}&date=${date}&eventType=${eventType}`
  );
  const ancillaryDataRaw: AncillaryDataRaw = await res.json();

  const ancillaryData: AncillaryPayload = {
    gpsTracks: ancillaryDataRaw.gpsTracks,
    photos: photoFilesByAncillaryPhotos(ancillaryDataRaw, year, month, date),
    videos: videoFilesByAncillaryVideos(ancillaryDataRaw, year, month, date),
  };

  return ancillaryData;
}

function photoFilesByAncillaryPhotos(
  ancillaryDataRaw: AncillaryDataRaw,
  year: number,
  month: number,
  date: number
): PhotoFile[] {
  const photoFiles = [];
  for (let i = 0; i < ancillaryDataRaw.photos.length; i++) {
    const currAncillaryPhoto = ancillaryDataRaw.photos[i];
    const dateTimeTaken = currAncillaryPhoto.hasOwnProperty("gps")
      ? currAncillaryPhoto.gps.timestamp
      : currAncillaryPhoto.dateTimeOriginal;

    let photoFile: PhotoFile = {
      id: currAncillaryPhoto.filenameRoot,
      title: "",
      description: "",
      collection: Collection.TEST_EVENTS,
      collections: currAncillaryPhoto.directory,
      dataURL: "#",
      mediaLowResURL: `https://emss.s3.us-gov-east-1.amazonaws.com/coda_data/ancillary_data/test_events/${year}-${month}-${date}/Photo/${currAncillaryPhoto.directory}/lores/${currAncillaryPhoto.filenameRoot}.jpg`,
      mediaHighResURL: `https://emss.s3.us-gov-east-1.amazonaws.com/coda_data/ancillary_data/test_events/${year}-${month}-${date}/Photo/${currAncillaryPhoto.directory}/hires/${currAncillaryPhoto.filenameRoot}.jpg`,
      dateAdded: currAncillaryPhoto.dateTimeOriginal,
      datetimeTaken: dateTimeTaken,
      datetimeTakenAppSeconds: appSecondsFromDateString(dateTimeTaken),
    };

    if (currAncillaryPhoto.hasOwnProperty("gps")) {
      photoFile.gps = currAncillaryPhoto.gps;
    }

    photoFiles.push(photoFile);
  }
  return photoFiles;
}

function videoFilesByAncillaryVideos(
  ancillaryDataRaw: AncillaryDataRaw,
  year: number,
  month: number,
  date: number
): VideoFile[] {
  const videoFiles = [];
  for (let i = 0; i < ancillaryDataRaw.videos.length; i++) {
    const currentAncillaryVideo = ancillaryDataRaw.videos[i];

    //this date and duration process is from io-api.ts -- to make these durations compatible with io video
    let dateArr = currentAncillaryVideo.dateTime
      // regex match for the date
      .match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).000000Z/)
      // remove the first item (the full matched string)
      .slice(1)
      .map((n: string) => parseInt(n));

    const UTCstartMilliseconds = Date.UTC(
      dateArr[0],
      dateArr[1] - 1,
      dateArr[2],
      dateArr[3],
      dateArr[4],
      dateArr[5]
    );
    const duration_ms = (currentAncillaryVideo.durationSeconds || 0) * 1000;
    const UTCend = new Date(UTCstartMilliseconds + duration_ms);

    const videoFile: VideoFile = {
      id: currentAncillaryVideo.filename,
      start: UTCstartMilliseconds / 1000,
      end: UTCend.valueOf() / 1000,
      downlink: currentAncillaryVideo.downlink,
      startDateTime: currentAncillaryVideo.dateTime,
      mediaLowResURL: `https://emss.s3.us-gov-east-1.amazonaws.com/coda_data/ancillary_data/test_events/${year}-${month}-${date}/Video/lores/${currentAncillaryVideo.filename}`,
      mediaHighResURL: `https://emss.s3.us-gov-east-1.amazonaws.com/coda_data/ancillary_data/test_events/${year}-${month}-${date}/Video/medres/${currentAncillaryVideo.filename}`,
      LOS: false,
      priority: 1,
      description: "",
      collection: Collection.TEST_EVENTS,
      collections: "",
      dataURL: `https://emss.s3.us-gov-east-1.amazonaws.com/coda_data/ancillary_data/test_events/${year}-${month}-${date}/Video/medres/${currentAncillaryVideo.filename}`,
    };
    videoFiles.push(videoFile);
  }
  return videoFiles;
}
