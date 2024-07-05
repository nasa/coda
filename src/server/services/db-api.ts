import fetchWithTimeout from "utils/fetch-with-timeout";
import fetchWithCache from "../processing/cache-client";
import type { Response } from "node-fetch";

/**
 * Fetch override video manifest from the override location specified in the db
 */
export async function getManifest(
  override: MediaSourceOverride
): Promise<VideoFile[] | PhotoFile[] | UnprocessedTranscript[]> {
  const dataPath = `${override.url}/${override.type}Manifest.json`;

  let res: Response;
  try {
    res = await fetchWithTimeout(dataPath);
  } catch (e) {
    throw e;
  }
  return res.json() as Promise<VideoFile[] | PhotoFile[] | UnprocessedTranscript[]>;
}

/** Get all the manually set media source overrides.
 *
 * Data lives here: https://wiki.jsc.nasa.gov/exploration/index.php/CODA/Media_Source_Overrides
 */
export async function fetchMediaOverrides(
  forceNew: boolean = false
): Promise<WrappedResponse<MediaSourceOverride[]>> {
  const retriever = async () => {
    const res = await fetch("/api/v1/db/mediaOverrides");
    const data: WrappedResponse<MediaOverrideList[]> = await res.json();
    // Assuming the actual overrides are stored in `data.data`
    return data.data as MediaSourceOverride[];
  };

  return await fetchWithCache<MediaSourceOverride[]>({
    identifier: "media-overrides",
    cacheFolder: "wiki",
    retriever,
    // cacheAge: 604800, //1 week
    // cacheAge: 31536000, // 1 year
    cacheAge: 86400, // 1 day
    forceRetriever: forceNew,
  });
}
