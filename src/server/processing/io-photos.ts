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
          return undefined;
        }
      })(),
    ]);

    if (isNil(allOverrides)) {
      // we don't have the info required to apply time offsets. just return the photos
      return buildResponse({ data: ioPhotos ?? [] });
    }

    // Find overrides matching this date and CODA source.
    // Each override has a nasaIdRegex field (".*" = all photos, or a regex like "^nhq").
    ConsoleLogger.debug(
      `Photo timeshifts: ${allOverrides.length} total overrides, looking for date=${dateWanted} source=${source}`
    );
    const dateOverrides = allOverrides.filter(
      (override) => override.date === dateWanted && override.source === source
    );
    ConsoleLogger.debug(
      `Photo timeshifts: ${dateOverrides.length} matching overrides for ${dateWanted}/${source}`,
      dateOverrides
    );

    if (dateOverrides.length === 0) {
      return buildResponse({ data: ioPhotos ?? [] });
    }

    // Pre-parse all offsets into milliseconds with compiled regexes
    const parsedOffsets: { regex: RegExp; pattern: string; offsetMs: number }[] = [];
    for (const override of dateOverrides) {
      const match = override.timeOffset.match(/([\+]|[\-])(\d{2}):(\d{2}):(\d{2})/);
      if (!match) {
        ConsoleLogger.warn(`Invalid photo time offset format: ${override.timeOffset}`);
        continue;
      }
      const [, sign, hh, mm, ss] = match;
      const offsetMs = ((+`${sign}${hh}` * 60 + +`${sign}${mm}`) * 60 + +`${sign}${ss}`) * 1000;
      try {
        parsedOffsets.push({
          regex: new RegExp(override.nasaIdRegex),
          pattern: override.nasaIdRegex,
          offsetMs,
        });
      } catch (e) {
        ConsoleLogger.warn(`Invalid NASA ID regex "${override.nasaIdRegex}": ${e}`);
      }
    }

    try {
      const data: PhotoFile[] = (ioPhotos ?? []).map((result) => {
        // Find the best matching offset for this photo.
        // ".*" matches everything; more specific patterns take priority.
        // Longer regex patterns are assumed to be more specific.
        const matching = parsedOffsets
          .filter((o) => o.regex.test(result.id))
          .sort((a, b) => {
            // ".*" has lowest priority; otherwise longer pattern wins
            if (a.pattern === ".*") return 1;
            if (b.pattern === ".*") return -1;
            return b.pattern.length - a.pattern.length;
          });

        if (matching.length === 0) return result;

        const res = clone(result);
        res.datetimeTaken = addMs(new Date(res.datetimeTaken), -matching[0].offsetMs).toISOString();
        res.datetimeTakenAppSeconds = appSecondsFromDateString(res.datetimeTaken);
        return res;
      });

      // Re-sort by corrected time since different prefixes may have different offsets,
      // which changes the relative ordering of photos from different cameras.
      data.sort((a, b) => a.datetimeTakenAppSeconds - b.datetimeTakenAppSeconds);

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
