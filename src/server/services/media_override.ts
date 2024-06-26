import fetchWithTimeout from "utils/fetch-with-timeout";

/**
 * Fetch override video manifest from the override location specified in the wiki
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
