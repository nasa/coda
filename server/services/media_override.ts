/**
 * Fetch override video manifest from the override location specified in the wiki
 */
export async function getManifest(
  override: MediaSourceOverride
): Promise<VideoFile[] | PhotoFile[]> {
  const dataPath = `${override.url}/${override.type}Manifest.json`;

  let res: Response;
  try {
    res = await fetch(dataPath);
  } catch (e) {
    throw e;
  }
  return res.json();
}
