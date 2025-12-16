import clone from "lodash/clone";
import isNil from "lodash/isNil";
import sortBy from "lodash/sortBy";
import { fetchIoData, fetchForgedIoManifest } from "server/processing/io-api";
import { getMediaOverridesList } from "server/express/routes/db/mediaOverrides";
import { getPhotoTimeshiftRecordsList } from "server/express/routes/db/photos";
import { collection } from "utils/consts";
import { appSecondsFromDateString } from "utils/formatting";
import { addMs } from "../../utils/date";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Fetch photo data from IO. We can't always trust the accuracy of IO's dates, so we fetch photos from the day before and day after as well
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

    const [ioPhotos, allOverrides] = await Promise.all([
      fetchIoData({
        collection: col,
        fetchType: "photos",
        requestedDate,
      }) as Promise<PhotoFile[]>,
      // fetch start time overrides, but don't throw if the request fails
      (async () => {
        try {
          return await getPhotoTimeshiftRecordsList();
        } catch (overrideError) {
          // don't block photo results if we can't find overrides
          ConsoleLogger.warn("Error fetching photo timeshift overrides:", overrideError);
        }
      })(),
    ]);

    if (isNil(allOverrides)) {
      // we don't have the info required to apply time offsets. just return the photos
      return buildResponse({ data: ioPhotos ?? [] });
    }

    // Find override for this date
    const overrides = allOverrides.find((override) => override.date === dateWanted);

    // no overrides for this date
    if (isNil(overrides)) {
      return buildResponse({ data: ioPhotos ?? [] });
    }

    try {
      const match = overrides.timeOffset.match(/([\+]|[\-])(\d{2}):(\d{2}):(\d{2})/);
      if (!match) {
        throw new Error(`Invalid photo time offset format: ${overrides.timeOffset}`);
      }

      const [, sign, hh, mm, ss] = match;
      const milliseconds = ((+`${sign}${hh}` * 60 + +`${sign}${mm}`) * 60 + +`${sign}${ss}`) * 1000;

      const data: PhotoFile[] = (ioPhotos ?? []).map((result) => {
        const res = clone(result);
        // shift the date
        res.datetimeTaken = addMs(new Date(res.datetimeTaken), -milliseconds).toISOString();
        res.datetimeTakenAppSeconds = appSecondsFromDateString(res.datetimeTaken);
        return res;
      });

      return buildResponse({ data });
    } catch (timeOverrideError) {
      ConsoleLogger.error("Error parsing and apply photo overrides");
      ConsoleLogger.error(timeOverrideError);
      return buildResponse({ data: ioPhotos ?? [] });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error fetching photo data";
    return buildResponse({ error: message });
  }
}
