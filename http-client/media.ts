/*
Client-side methods for fetching from Imagery Online (IO)
*/
import { Collection } from "typings";
import type { CollectionFilters } from "store/photos";
import type { PhotoFile, VideoFile, WrappedResponse } from "typings";
import { cleanCollectionsString } from "utils/formatting";

/**
 * Fetch and format all videos for passing to the redux store
 */
export async function buildVideoStore(
  year: number,
  month: number,
  date: number,
  collection: Collection
): Promise<VideoFile[]> {
  const res = await fetch(
    `/api/media/videos?year=${year}&month=${month}&date=${date}&collection=${collection}`
  );
  const wrappedResponse: WrappedResponse<VideoFile[]> = await res.json();
  return wrappedResponse.data;
}

/**
 * Fetch and format all photos for passing to the redux store
 */
export async function buildPhotoStore(
  year: number,
  month: number,
  date: number,
  collection: Collection
): Promise<PhotoFile[]> {
  const res = await fetch(
    `/api/media/photos?year=${year}&month=${month}&date=${date}&collection=${collection}`
  );
  const wrappedResponse: WrappedResponse<PhotoFile[]> = await res.json();
  return wrappedResponse.data;
}

export function buildPhotoCollections(photos: PhotoFile[]) {
  const collections: CollectionFilters[] = [];
  const uniqueList = [];
  for (let i = 0; i <= photos.length; i++) {
    if (photos[i] !== undefined) {
      if (!uniqueList.includes(photos[i].collections)) {
        const collectionsObject: CollectionFilters = {
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
