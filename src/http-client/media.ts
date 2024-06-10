/*
Client-side methods for fetching from Imagery Online (IO)
*/
import { Collection } from "utils/enums";
import { cleanCollectionsString } from "utils/formatting";

/**
 * Fetch and format all videos for passing to the redux store
 */
export async function buildVideoStore(
  year: number,
  month: number,
  date: number,
  collection: Collection,
  emssVideoEnabled: boolean
): Promise<WrappedResponse<VideoFile[]>> {
  // fetch IO videos
  const ioRes = await fetch(
    `/api/v1/media/videos?year=${year}&month=${month}&date=${date}&collection=${collection}`
  );
  const ioResponse: WrappedResponse<VideoFile[]> = await ioRes.json();

  // If user hasn't enabled EMSS videos, return IO videos only
  if (!emssVideoEnabled) {
    return ioResponse;
  }

  // fetch EMSS videos as well. The server returns [] if there was nothing found
  const emssRes = await fetch(
    `/api/v1/media/emssVideos?year=${year}&month=${month}&date=${date}&collection=${collection}`
  );
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
  year: number,
  month: number,
  date: number,
  collection: Collection
): Promise<WrappedResponse<PhotoFile[]>> {
  const res = await fetch(
    `/api/v1/media/photos?year=${year}&month=${month}&date=${date}&collection=${collection}`
  );
  const wrappedResponse: WrappedResponse<PhotoFile[]> = await res.json();
  return wrappedResponse;
}

export function buildPhotoCollections(photos: PhotoFile[]) {
  const collections: PhotoCollectionFilters[] = [];
  const uniqueList = [];
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
    var valA = a.display.toUpperCase(); // ignore upper and lowercase
    var valB = b.display.toUpperCase(); // ignore upper and lowercase
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
