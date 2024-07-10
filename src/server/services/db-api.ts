import fetchWithTimeout from "utils/fetch-with-timeout";
import { getMediaOverridesList } from "../express/routes/db/mediaOverrides";

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

/** Get the list of ancillary data sources from the db
 *
 * Data lives here: https://wiki.jsc.nasa.gov/exploration/index.php/CODA/Ancillary_Data_Sources
 */
export async function fetchAncillaryDataSourceList(
  forceNew: boolean = false
): Promise<WrappedResponse<AncillaryDataSource[]>> {
  const retriever = async () => {
    const res = await fetch("/api/v1/db/ancillaryDataSources");
    const data: WrappedResponse<AncillaryDataSourceList[]> = await res.json();
    // Assuming the actual overrides are stored in `data.data`
    return data.data as AncillaryDataSource[];
  };

  return await fetchWithCache<AncillaryDataSource[]>({
    identifier: "ancillary-data-sources",
    cacheFolder: "wiki",
    retriever,
    cacheAge: 604800, //1 week
    forceRetriever: forceNew,
  });
}
