import clone from "lodash/clone";
import isNil from "lodash/isNil";
import * as IoService from "server/services/io-api";
import * as WikiService from "server/services/wiki-api";
import * as DbService from "server/services/db-api";
import { collection } from "utils/consts";
import { appSecondsFromDateString } from "utils/formatting";
import _ from "lodash";
import { addMs, isSameDate } from "../../../utils/date";

/**
 * Fetch photo data from IO. We can't always trust the accuracy of IO's dates, so we fetch photos from the day before and day after as well
 */
export default async function getPhotoData({
  dateWanted,
  source,
  forceNew,
}: {
  dateWanted: string;
  source: Source;
  forceNew: boolean;
}): Promise<WrappedResponse<PhotoFile[]>> {
  const [year, month, date] = dateWanted.split("-").map((x) => parseInt(x, 10));
  const requestedDate = new Date(Date.UTC(year, month - 1, date));

  // Fetch video source overrides from the wiki for this date. If there are none, then use Imagery Online
  try {
    let mediaOverrides = await DbService.fetchMediaOverrides();

    // Check if there is a video override for this date and Source
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
      const photos = _.sortBy(
        (await DbService.getManifest(mediaOverride)) as PhotoFile[],
        "datetimeTaken"
      );

      return {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
          expiration: null,
        },
        data: photos,
      } as WrappedResponse<PhotoFile[]>;
    }
  } catch (e) {
    // don't block results if media overrides call fails
    console.error(e);
  }

  const col = collection[source];
  const [results, sequences, allOverrides] = await Promise.all([
    IoService.fetchData({
      collection: col,
      fetchType: "photos",
      requestedDate,
      forceNew,
    }) as Promise<WrappedResponse<PhotoFile[]>>,
    // fetch sequence data, but don't throw if the request fails
    await (async () => {
      try {
        return await WikiService.fetchSequences(source, forceNew);
      } catch (e) {
        console.error(e);
      }
    })(),
    // fetch start time overrides, but don't throw if the request fails
    await (async () => {
      try {
        return await DbService.fetchPhotoDateTimeOverrides();
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

  const seqs = sequences.data?.filter(
    (seq) => isSameDate(new Date(seq.startDate), requestedDate) //||
    // isSameDate(new Date(seq.startDate), previousDate) ||
    // isSameDate(new Date(seq.startDate), nextDate)
  );

  // no sequence corresponds with this date so there won't be any overrides
  if (!seqs || seqs?.length === 0) {
    return results;
  }

  let overrides: PhotoRecord;

  for (let override of allOverrides) {
    for (let seq of seqs) {
      if (override.date === seq.startDate) {
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
    const [_, sign, hh, mm, ss] = overrides.timeOffset.match(/([\+]|[\-])(\d{2}):(\d{2}):(\d{2})/);

    const milliseconds = ((+`${sign}${hh}` * 60 + +`${sign}${mm}`) * 60 + +`${sign}${ss}`) * 1000;

    // we got overrides from the wiki, so apply them
    const data: PhotoFile[] = results.data.map((result) => {
      const res = clone(result);
      // shift the date
      res.datetimeTaken = addMs(new Date(res.datetimeTaken), -milliseconds).toISOString();
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
