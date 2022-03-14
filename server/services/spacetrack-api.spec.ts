import * as SpacetrackService from "server/services/spacetrack-api";
import fetchWithCache from "server/services/cache-client";

jest.mock("server/services/cache-client");
const fetchMock = fetchWithCache as jest.MockedFunction<typeof fetchWithCache>;

describe("server/services/spacetrack-api", () => {
  beforeEach(() => {
    fetchMock.mockClear();
  });

  // as if spacetrack just gave us a good response with no TLEs
  const emptyResponse = Promise.resolve({
    cacheMetadata: null as CacheMetadata,
    data: {
      ephemera: [],
      dayNight: [],
    },
  });

  // as if we accidentally cached bad data
  const badCache = Promise.resolve({
    cacheMetadata: null as CacheMetadata,
    data: {
      ephemera: [],
      dayNight: [],
    },
  });

  it("should fetch locations from spacetrack", async () => {
    fetchMock.mockReturnValue(emptyResponse);

    await SpacetrackService.fetchISSLocation(2000, 1, 1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should fetch twice if the first one returns empty TLEs from the cache", async () => {
    fetchMock.mockReturnValueOnce(badCache);
    fetchMock.mockReturnValueOnce(emptyResponse);

    await SpacetrackService.fetchISSLocation(2000, 1, 1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should fetch yesterday's data if we want today and the first one returns empty TLEs", async () => {
    // as if we accidentally cached bad data
    const goodData = Promise.resolve({
      cacheMetadata: null as CacheMetadata,
      data: {
        // using null here because EphemerisFiles are crazy big
        // just note there are two
        ephemera: [null, null],
        dayNight: [{ appSeconds: 0, daylight: false }],
      },
    });

    fetchMock.mockReturnValueOnce(emptyResponse);
    fetchMock.mockReturnValueOnce(goodData);

    const today = new Date();
    const res = await SpacetrackService.fetchISSLocation(
      today.getUTCFullYear(),
      today.getUTCMonth() + 1,
      today.getUTCDate()
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.data.ephemera).toHaveLength(2);
  });

  it("should throw if an actual error is thrown by the retriever", async () => {
    fetchMock.mockRejectedValue(new Error("you done messed up"));

    let erred = false;
    try {
      await SpacetrackService.fetchISSLocation(2000, 1, 1);
    } catch (e) {
      erred = true;
    }

    expect(erred).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
