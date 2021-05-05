/*
Client-side methods for fetching from Imagery Online (IO)
*/
import type { CollectionFilters } from "store/photos";
import { PhotoFile, VideoFile } from "typings/io";

async function fetchVideoData(year: number, month: number, date: number): Promise<VideoFile[]> {
  const res = await fetch(`/api/io/videos?year=${year}&month=${month}&date=${date}`);
  return await res.json();
}

async function fetchPhotoData(year: number, month: number, date: number): Promise<PhotoFile[]> {
  const res = await fetch(`/api/io/photos?year=${year}&month=${month}&date=${date}`);
  return await res.json();
}

/**
 * Fetch and format all videos for passing to the redux store
 */
export async function buildVideoStore(
  year: number,
  month: number,
  date: number
): Promise<VideoFile[]> {
  const videos = await fetchVideoData(year, month, date);
  return videos;
}

/**
 * Fetch and format all photos for passing to the redux store
 */
export async function buildPhotoStore(
  year: number,
  month: number,
  date: number
): Promise<PhotoFile[]> {
  const photos = await fetchPhotoData(year, month, date);
  return photos;
}

export function buildPhotoCollections(photos: PhotoFile[]) {
  const collections: CollectionFilters[] = [];
  const uniqueList = [];
  for (let i = 0; i <= photos.length; i++) {
    if (photos[i] !== undefined) {
      if (!uniqueList.includes(photos[i].collections_string)) {
        const collectionsObject: CollectionFilters = {
          fullList: photos[i].collections_string,
          display: photos[i].collections_string_pretty,
          selected: true,
        };
        collections.push(collectionsObject);
        uniqueList.push(photos[i].collections_string);
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
