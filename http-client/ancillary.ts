import { AncillaryState } from "store/ancillary";
import { Collection, PhotoFile } from "typings/index.d";
import type { AncillaryPayload } from "typings/ancillary";
import { appSecondsFromDateString, cleanCollectionsString } from "utils/formatting";

export async function buildAncillaryPayloadsStore(
  year: number,
  month: number,
  date: number,
  eventType: string
): Promise<AncillaryState> {
  const res = await fetch(
    `/api/ancillary/getAncillaryData?year=${year}&month=${month}&date=${date}&eventType=${eventType}`
  );
  const ancillaryPayload: AncillaryPayload = await res.json();

  const photoFiles = [];
  for (let i = 0; i < ancillaryPayload.photos.length; i++) {
    const currAncillaryPhoto = ancillaryPayload.photos[i];
    const dateTimeTaken = currAncillaryPhoto.hasOwnProperty("gps")
      ? currAncillaryPhoto.gps.timestamp
      : currAncillaryPhoto.dateTimeOriginal;

    let photoFile: PhotoFile = {
      id: "",
      title: "",
      description: "",
      collection: Collection.TEST_EVENTS,
      collections: "",
      dataURL: "#",
      mediaLowResURL: `https://emss.s3.us-gov-east-1.amazonaws.com/coda_data/ancillary_data/test_events/${year}-${month}-${date}/Photo/${currAncillaryPhoto.directory}/lores/${currAncillaryPhoto.filenameRoot}.jpg`,
      mediaHighResURL: `https://emss.s3.us-gov-east-1.amazonaws.com/coda_data/ancillary_data/test_events/${year}-${month}-${date}/Photo/${currAncillaryPhoto.directory}/lores/${currAncillaryPhoto.filenameRoot}.jpg`,
      dateAdded: currAncillaryPhoto.dateTimeOriginal,
      datetimeTaken: dateTimeTaken,
      datetimeTakenAppSeconds: appSecondsFromDateString(dateTimeTaken),
    };

    if (currAncillaryPhoto.hasOwnProperty("gps")) {
      photoFile.gps = currAncillaryPhoto.gps;
    }

    photoFiles.push(photoFile);
  }

  return {
    ancillaryData: {
      gps_tracks: ancillaryPayload.gps_tracks,
      photos: photoFiles,
    },
    errorMessage: "",
  };
}
