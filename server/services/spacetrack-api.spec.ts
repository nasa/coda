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

    expect(fetchMock).toHaveBeenCalledTimes(1);
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
