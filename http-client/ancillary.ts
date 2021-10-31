import { ancillarySlice, AncillaryState } from "store/ancillary";
import { Collection, PhotoFile } from "typings/index.d";
import type { AncillaryDataRaw } from "typings/ancillary";
import { appSecondsFromDateString } from "utils/formatting";

export async function buildAncillaryDataStore(
  year: number,
  month: number,
  date: number,
  eventType: string
): Promise<AncillaryState> {
  const res = await fetch(
    `/api/ancillary/getAncillaryData?year=${year}&month=${month}&date=${date}&eventType=${eventType}`
  );
  const ancillaryState: AncillaryState = {
    ancillaryData: {
      gpsTracks: [],
      photos: [],
      videos: [],
    },
    errorMessage: "",
  };

  const ancillaryDataRaw: AncillaryDataRaw = await res.json();

  ancillaryState.ancillaryData.gpsTracks = ancillaryDataRaw.gpsTracks;

  ancillaryState.ancillaryData.photos = photoFilesByancillaryPhotos(
    ancillaryDataRaw,
    year,
    month,
    date
  );

  return ancillaryState;
}

function photoFilesByancillaryPhotos(
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
      id: "",
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
