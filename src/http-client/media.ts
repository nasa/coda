/*
Client-side methods for fetching from Imagery Online (IO)
*/
import _ from "lodash";
import { cleanCollectionsString, queryStringFromObject } from "utils/formatting";
/**
 * Fetch and format all videos for passing to the redux store
 */
export async function buildVideoStore(
  dateWanted: string,
  source: Source,
  emssVideoEnabled: boolean
): Promise<WrappedResponse<VideoFile[]>> {
  const queryParams: GetVideosQueryParams = {
    dateWanted,
    source,
  };
  const queryString = queryStringFromObject(queryParams);
  // fetch IO videos
  const ioRes = await fetch(`/api/v1/media/videos?${queryString}`);
  const ioResponse: WrappedResponse<VideoFile[]> = await ioRes.json();

  // If user hasn't enabled EMSS videos, return IO videos only
  if (!emssVideoEnabled) {
    return ioResponse;
  }

  // fetch EMSS videos as well. The server returns [] if there was nothing found
  const emssRes = await fetch(`/api/v1/media/emssVideos?${queryString}`);
  const emssResponse: WrappedResponse<VideoFile[]> = await emssRes.json();

  // merge the two video sources but use the responseMetadata from the io response in case it's "inprogress"
  const allVideos = ioResponse.data.concat(emssResponse.data);
  allVideos.sort((a, b) => a.start - b.start);
  const allVideosWrappedResponse: WrappedResponse<VideoFile[]> = {
    responseMetadata: ioResponse.responseMetadata,
    data: allVideos,
  };

  return allVideosWrappedResponse;
}

/**
 * Fetch and format all photos for passing to the redux store
 */
export async function buildPhotoStore(
  dateWanted: string,
  source: Source
): Promise<WrappedResponse<PhotoFile[]>> {
  const queryParams: GetPhotosQueryParams = {
    dateWanted,
    source,
  };
  const queryString = queryStringFromObject(queryParams);
  const res = await fetch(`/api/v1/media/photos?${queryString}`);
  const wrappedResponse: WrappedResponse<PhotoFile[]> = await res.json();
  return wrappedResponse;
}

export function buildPhotoCollections(photos: PhotoFile[]) {
  const collections: PhotoCollectionFilters[] = [];
  const uniqueList: string[] = [];
  for (let i = 0; i <= photos.length; i++) {
    if (photos[i] !== undefined) {
      if (!uniqueList.includes(photos[i].collections)) {
        const collectionsObject: PhotoCollectionFilters = {
          fullList: photos[i].collections,
          display: cleanCollectionsString(photos[i].collections),
          selected: true,
        };
        collections.push(collectionsObject);
        uniqueList.push(photos[i].collections);
      }
    }
  }
  //sort collections alphabetically.
  collections.sort(function (a, b) {
    const valA = a.display.toUpperCase(); // ignore upper and lowercase
    const valB = b.display.toUpperCase(); // ignore upper and lowercase
    if (valA < valB) {
      return -1;
    }
    if (valA > valB) {
      return 1;
    }
    return 0;
  });
  return collections;
}

export async function buildMTXPlaybackStore({
  dateWanted,
  source,
}: {
  dateWanted: string;
  source: Source;
}): Promise<WrappedResponse<MTXApiResponses>> {
  const queryParams: GetMTXPlaybackQueryParams = {
    source,
  };
  const queryString = queryStringFromObject(queryParams);
  const res = await fetch(`/api/v1/media/videosMediaMtx?${queryString}`);
  const wrappedResponse: WrappedResponse<MTXApiResponses> = await res.json();

  const dateWantedDate = new Date(dateWanted);

  const newMtxPlaybackAvailability = {
    ...wrappedResponse.data.mtxPlaybackAvailability,
  };

  /**
   * Check all the mtxPlayback records for their start times and duration
   * These playback records can span multiple days, but CODA can only play one day at a time
   * This function modifies the playback ranges to only show the portion of the playback that is available for the current day
   * */
  for (let channel = 1; channel <= 8; channel++) {
    const mtxPlaybackRecords = newMtxPlaybackAvailability[channel.toString()] || [];

    for (const mtxPlaybackRecord of mtxPlaybackRecords) {
      // the mtx playback record starts before the beginning of today, check if it ends after the beginning of today
      if (new Date(mtxPlaybackRecord.start).getTime() < dateWantedDate.getTime()) {
        const mtxDLEndDate =
          new Date(mtxPlaybackRecord.start).getTime() + mtxPlaybackRecord.duration * 1000;

        // if the segment ends after the beginning of today, then we use it by making the start time the beginning of today
        // and adjust the duration so it renders properly
        if (mtxDLEndDate > new Date(dateWanted).getTime()) {
          mtxPlaybackRecord.duration =
            mtxPlaybackRecord.duration -
            (dateWantedDate.getTime() - new Date(mtxPlaybackRecord.start).getTime()) / 1000;

          // if the clip, even with the adjusted start time and duration longer than the current day, then we adjust the duration to be the length of the current day
          if (mtxDLEndDate > dateWantedDate.getTime() + 86400000) {
            mtxPlaybackRecord.duration = 86400;
          }
          mtxPlaybackRecord.start = dateWantedDate.toISOString();
        }
      }
    }
    newMtxPlaybackAvailability[channel.toString()] = mtxPlaybackRecords;

    return {
      ...wrappedResponse,
      data: { ...wrappedResponse.data, mtxPlaybackAvailability: newMtxPlaybackAvailability },
    };
  }
}
