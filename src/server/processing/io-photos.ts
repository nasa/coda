import clone from "lodash/clone";
import isNil from "lodash/isNil";
import sortBy from "lodash/sortBy";
import { fetchIoData, fetchForgedIoManifest } from "server/processing/io-api";
import { getMediaOverridesList } from "server/express/routes/db/mediaOverrides";
import { collection } from "utils/consts";
import { appSecondsFromDateString } from "utils/formatting";
import { addMs } from "../../utils/date";
import ConsoleLogger from "utils/logging/consoleLogger";
import artemis2PhotoTimeOverrides from "server/processing/artemis2/photos/photo-time-overrides.json";

/**
 * Fetch photo data from IO for a given date. Fetches the previous day as well
 * to catch photos whose local-time timestamp shifts past midnight when
 * corrected to UTC (e.g., a photo taken at 22:00 CDT becomes 03:00 UTC the
 * next day). After applying timezone corrections, photos that don't fall on
 * the requested UTC day are filtered out.
 */
export default async function getPhotoData({
  dateWanted,
  source,
}: {
  dateWanted: string;
  source: Source;
}): Promise<FetchResponse<PhotoFile[]>> {
  const buildResponse = ({
    data,
    error,
    origin,
  }: {
    data?: PhotoFile[];
    error?: string | undefined;
    origin?: string;
  }): FetchResponse<PhotoFile[]> => ({
    data: data ?? [],
    fetchMetadata: {
      success: !error,
      error,
      timestamp: new Date().toISOString(),
    },
    origin: origin ?? "io",
  });

  try {
    const [year, month, date] = dateWanted.split("-").map((x) => parseInt(x, 10));
    const requestedDate = new Date(Date.UTC(year, month - 1, date));

    let mediaOverrides: MediaOverride[] | undefined;
    // Fetch video source overrides from the wiki for this date. If there are none, then use Imagery Online
    try {
      mediaOverrides = await getMediaOverridesList();
    } catch (overrideError) {
      // don't block results if media overrides call fails
      ConsoleLogger.warn("Error fetching media overrides:", overrideError);
    }

    const mediaOverride = mediaOverrides?.find((vo) => {
      const overrideDate = new Date(vo.date);
      return (
        overrideDate.getTime() === requestedDate.getTime() &&
        vo.source === source &&
        vo.type === "photo"
      );
    });

    // if there are media overrides, use those instead of IO
    if (mediaOverride) {
      const photos = sortBy(
        (await fetchForgedIoManifest(mediaOverride)) as PhotoFile[],
        "datetimeTaken"
      );
      return buildResponse({ data: photos, origin: "override" });
    }

    if (!source) {
      throw new Error("Source is required to fetch photo data");
    }

    const col = collection[source];
    if (isNil(col)) {
      throw new Error(`Unable to resolve IO collection for source ${source}`);
    }

    // Fetch photos for the requested day AND the previous day. Photos whose
    // md_creation_date is on the previous day may land on the requested day
    // after timezone correction (e.g., 22:00 CDT → 03:00 UTC next day).
    const previousDate = addMs(requestedDate, -86400000);

    const [ioPhotosToday, ioPhotosPrevDay] = await Promise.all([
      fetchIoData({
        collection: col,
        fetchType: "photos",
        requestedDate,
      }) as Promise<PhotoFile[]>,
      fetchIoData({
        collection: col,
        fetchType: "photos",
        requestedDate: previousDate,
      }) as Promise<PhotoFile[]>,
    ]);

    // Merge and deduplicate (a photo could theoretically appear in both queries)
    const seenIds = new Set<string>();
    const allPhotos: PhotoFile[] = [];
    for (const photo of [...(ioPhotosToday ?? []), ...(ioPhotosPrevDay ?? [])]) {
      if (!seenIds.has(photo.id)) {
        seenIds.add(photo.id);
        allPhotos.push(photo);
      }
    }

    // Apply timezone corrections from the static per-photo override map.
    // Only applied for the ARTEMIS source within the Artemis 2 mission date range.
    // Photos not in the map are left uncorrected (their md_creation_date is
    // assumed to already be UTC).
    const ARTEMIS2_START = new Date("2026-04-01T00:00:00Z");
    const ARTEMIS2_END = new Date("2026-04-14T00:00:00Z"); // exclusive
    const applyA2Overrides =
      source === "ARTEMIS" && requestedDate >= ARTEMIS2_START && requestedDate < ARTEMIS2_END;

    const corrected: PhotoFile[] = allPhotos.map((result) => {
      if (!applyA2Overrides) return result;
      const override = (artemis2PhotoTimeOverrides as Record<string, string>)[result.id];
      if (!override) return result;

      const match = override.match(/([-+])(\d{2}):(\d{2}):(\d{2})/);
      if (!match) return result;

      const [, sign, hh, mm, ss] = match;
      const offsetMs = ((+`${sign}${hh}` * 60 + +`${sign}${mm}`) * 60 + +`${sign}${ss}`) * 1000;

      const res = clone(result);
      res.datetimeTaken = addMs(new Date(res.datetimeTaken), -offsetMs).toISOString();
      res.datetimeTakenAppSeconds = appSecondsFromDateString(res.datetimeTaken);
      return res;
    });

    // Filter to only photos that land on the requested UTC day after correction.
    const dayStartMs = requestedDate.getTime();
    const dayEndMs = dayStartMs + 86400000;

    const data = corrected
      .filter((photo) => {
        const photoMs = new Date(photo.datetimeTaken).getTime();
        return photoMs >= dayStartMs && photoMs < dayEndMs;
      })
      .sort((a, b) => a.datetimeTakenAppSeconds - b.datetimeTakenAppSeconds);

    return buildResponse({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error fetching photo data";
    return buildResponse({ error: message });
  }
}
