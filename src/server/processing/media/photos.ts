import clone from "lodash/clone";
import isNil from "lodash/isNil";
import sortBy from "lodash/sortBy";
import { retrieveIoData } from "server/services/io-api";
import * as DbService from "server/services/db-api";
import { collection } from "utils/consts";
import { appSecondsFromDateString } from "utils/formatting";
import { addMs } from "../../../utils/date";

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
  const buildSuccessResponse = (data: PhotoFile[], origin: string): FetchResponse<PhotoFile[]> => ({
    data,
    fetchMetadata: {
      success: true,
      error: undefined,
      timestamp: new Date().toISOString(),
    },
    source: origin,
  });

  const buildErrorResponse = (message: string): FetchResponse<PhotoFile[]> => ({
    data: [],
    fetchMetadata: {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    source: source ?? "io",
  });

  try {
    const [year, month, date] = dateWanted.split("-").map((x) => parseInt(x, 10));
    const requestedDate = new Date(Date.UTC(year, month - 1, date));

    let mediaOverrides: MediaOverride[] | undefined;
    // Fetch video source overrides from the wiki for this date. If there are none, then use Imagery Online
    try {
      mediaOverrides = await DbService.fetchMediaOverrides();
    } catch (overrideError) {
      // don't block results if media overrides call fails
      console.error(overrideError);
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
        (await DbService.getManifest(mediaOverride)) as PhotoFile[],
        "datetimeTaken"
      );
      return buildSuccessResponse(photos, "database");
    }

    if (!source) {
      throw new Error("Source is required to fetch photo data");
    }

    const col = collection[source];
    if (isNil(col)) {
      throw new Error(`Unable to resolve IO collection for source ${source}`);
    }

    const [ioPhotos, allOverrides] = await Promise.all([
      retrieveIoData({
        collection: col,
        fetchType: "photos",
        requestedDate,
      }) as Promise<PhotoFile[]>,
      // fetch start time overrides, but don't throw if the request fails
      (async () => {
        try {
          return await DbService.fetchPhotoDateTimeOverrides();
        } catch (overrideError) {
          // don't block photo results if we can't find overrides
          console.error(overrideError);
        }
      })(),
    ]);

    if (isNil(allOverrides)) {
      // we don't have the info required to apply time offsets. just return the photos
      return buildSuccessResponse(ioPhotos ?? [], "io");
    }

    // Find override for this date
    const overrides = allOverrides.find((override) => override.date === dateWanted);

    // no overrides for this date
    if (isNil(overrides)) {
      return buildSuccessResponse(ioPhotos ?? [], "io");
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

      return buildSuccessResponse(data, "io");
    } catch (timeOverrideError) {
      console.error("Error parsing and apply photo overrides from the wiki");
      console.error(timeOverrideError);
      return buildSuccessResponse(ioPhotos ?? [], "io");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error fetching photo data";
    return buildErrorResponse(message);
  }
}
