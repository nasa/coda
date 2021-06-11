import { fetchVideosForDates } from "services/io-api";
import { getDatetimeShifts } from "services/wiki-api";
import { add } from "store/playhead";
import { Collection, WrappedResponse } from "typings";
import { VideoFile } from "typings";

/**
 * Fetch video data from IO. We can't always trust the accuracy of IO's dates, so we fetch videos from the day before and day after as well
 */
export async function getVideoData(
  year: number,
  month: number,
  date: number,
  collection: Collection
): Promise<WrappedResponse<VideoFile[]>> {
  const requestedDate = new Date(Date.UTC(year, month - 1, date));
  const previousDate = add(requestedDate, -86400000);
  const nextDate = add(requestedDate, 86400000);

  // fetch and parse videos for the requested day, the day before, and the day after in parallel
  // this is necessary because IO's params s_dt and e_dt don't act like a range
  const datesToQuery = [
    [requestedDate],
    [previousDate],
    [nextDate],
    // videos that started yesterday and end "today" (the date requested)
    [previousDate, requestedDate],
    // videos that start "today" and end tomorrow
    [requestedDate, nextDate],
  ];

  const getAllVideoData = async (): Promise<WrappedResponse<VideoFile[]>> => {
    const results = await Promise.all(
      datesToQuery.map((dates) => fetchVideosForDates(collection, dates[0], dates[1]))
    );

    return results.reduce((prev, curr) => {
      return {
        mocked: prev.mocked || curr.mocked,
        cacheRead: prev.cacheRead || curr.cacheRead,
        cacheWrite: prev.cacheWrite || curr.cacheWrite,
        isCache: prev.isCache || curr.isCache,
        error: prev.error
          ? curr.error
            ? prev.error + " | " + curr.error
            : prev.error
          : curr.error ?? "",
        data: [...prev.data, ...curr.data],
      };
    });
  };

  const getOverrides = async () => {
    try {
      return await getDatetimeShifts();
    } catch (e) {
      // don't block video results if we can't find overrides
      console.error(e);
    }
  };

  // fetch video info and fudge factors in parallel
  const [results, overrides] = await Promise.all([getAllVideoData(), getOverrides()]);

  if (!overrides) {
    return results;
  }

  return results.map((result) => {
    if (overrides[0].length > 0) {
    }
  });
}
