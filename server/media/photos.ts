import clone from "lodash/clone";
import isNil from "lodash/isNil";
import * as IoService from "server/services/io-api";
import * as WikiService from "server/services/wiki-api";
import * as OverrideService from "server/services/media_override";
import { add, isSameDate } from "store/playhead";
import { Collection, IOFetchType } from "utils/enums";
import { appSecondsFromDateString } from "utils/formatting";

/**
 * Fetch photo data from IO. We can't always trust the accuracy of IO's dates, so we fetch photos from the day before and day after as well
 */
export default async function getPhotoData(
  year: number,
  month: number,
  date: number,
  collection: Collection,
  forceNew: boolean
): Promise<WrappedResponse<PhotoFile[]>> {
  const requestedDate = new Date(Date.UTC(year, month - 1, date));

  // Fetch video source overrides from the wiki for this date. If there are none, then use Imagery Online
  try {
    const mediaOverrides = await WikiService.fetchMediaOverrides(forceNew);

    // Check if there is a video override for this date and Source
    const mediaOverride = mediaOverrides?.data?.find((vo) => {
      const overrideDate = new Date(vo.date);
      return (
        overrideDate.getTime() === requestedDate.getTime() &&
        vo.source === collection &&
        vo.type === "photo"
      );
    });

    // if there are media overrides, use those instead of IO
    if (mediaOverride) {
      const photos = (await OverrideService.getManifest(mediaOverride)) as PhotoFile[];

      return {
        cacheMetadata: {
          fromCache: false,
          timestamp: new Date(),
          expiration: null,
        },
        data: photos,
      } as WrappedResponse<PhotoFile[]>;
    }
  } catch (e) {
    // don't block results if media overrides call fails
    console.error(e);
  }

  const [results, sequences, allOverrides] = await Promise.all([
    IoService.fetchData(collection, IOFetchType.PHOTOS, requestedDate, forceNew) as Promise<
      WrappedResponse<PhotoFile[]>
    >,
    // fetch sequence data, but don't throw if the request fails
    await (async () => {
      try {
        return await WikiService.fetchSequences(collection, forceNew);
      } catch (e) {
        console.error(e);
      }
    })(),
    // fetch start time overrides, but don't throw if the request fails
    await (async () => {
      try {
        return await WikiService.fetchDatetimeOverrides(forceNew);
      } catch (e) {
        // don't block photo results if we can't find overrides
        console.error(e);
      }
    })(),
  ]);

  if (isNil(allOverrides) || isNil(sequences)) {
    // we don't have the info required to apply fudge factors. just return the photos
    return results;
  }

  const seqs = sequences.data.filter(
    (seq) => isSameDate(new Date(seq.startDate), requestedDate) //||
    // isSameDate(new Date(seq.startDate), previousDate) ||
    // isSameDate(new Date(seq.startDate), nextDate)
  );

  // no sequence corresponds with this date so there won't be any overrides
  if (seqs.length === 0) {
    return results;
  }

  let overrides: TestEventOffsets;

  for (let override of allOverrides.data.testEventTimezones) {
    for (let seq of seqs) {
      if (`Test Event:${override.testEventID}` === seq.name) {
        overrides = override;
        break;
      }
    }
    if (overrides) break;
  }

  // no overrides for this date
  if (isNil(overrides)) {
    return results;
  }

  try {
    const [_, sign, hh, mm, ss] = overrides.timeoffset.match(/([\+]|[\-])(\d{2}):(\d{2}):(\d{2})/);

    const milliseconds = ((+`${sign}${hh}` * 60 + +`${sign}${mm}`) * 60 + +`${sign}${ss}`) * 1000;

    // we got overrides from the wiki, so apply them
    const data: PhotoFile[] = results.data.map((result) => {
      const res = clone(result);
      // shift the date
      res.datetimeTaken = add(new Date(res.datetimeTaken), -milliseconds).toISOString();
      res.datetimeTakenAppSeconds = appSecondsFromDateString(res.datetimeTaken);
      return res;
    });

    return {
      ...results,
      data,
    };
  } catch (e) {
    console.error("Error parsing and apply photo overrides from the wiki");
    console.error(e);
    return results;
  }
}
