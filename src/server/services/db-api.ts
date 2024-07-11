import fetchWithTimeout from "utils/fetch-with-timeout";
import { getMediaOverridesList } from "../express/routes/db/mediaOverrides";
import type { Response } from "node-fetch";

/**
 * Fetch override video manifest from the override location specified in the db
 */
export async function getManifest(
  override: MediaOverride
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
export async function fetchMediaOverrides(): Promise<MediaOverride[]> {
  const mediaOverridesList = await getMediaOverridesList();

  return mediaOverridesList as MediaOverride[];
}
