import * as EphemeraService from "server/services/ephemera-api";
import fetchWithTimeout from "utils/fetch-with-timeout";

jest.mock("utils/fetch-with-timeout");
const fetchWithTimeoutMock = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;

describe("server/services/ephemera-api", () => {
  beforeEach(() => {
    jest.useRealTimers();
    fetchWithTimeoutMock.mockReset();
  });

  const buildLoginResponse = (cookie: string | null) => ({
    headers: {
      get: (header: string) => (header.toLowerCase() === "set-cookie" ? cookie : null),
    },
  });

  it("returns spacetrack data when available", async () => {
    const loginResponse = buildLoginResponse("session=token");
    const spacetrackResponse = {
      json: async (): Promise<any[]> => [
        {
          EPOCH: "2024-01-01T00:00:00",
          TLE_LINE0: "0",
          TLE_LINE1: "1",
          TLE_LINE2: "2",
        },
      ],
    };

    fetchWithTimeoutMock.mockImplementation(async (url: any) => {
      const asString = String(url);
      if (asString.includes("ajaxauth")) {
        return loginResponse as any;
      }
      if (asString.includes("basicspacedata")) {
        return spacetrackResponse as any;
      }
      throw new Error(`Unexpected URL: ${asString}`);
    });

    const response = await EphemeraService.fetchISSLocation(2000, 1, 1);

    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(2);
    expect(response.fetchMetadata.success).toBe(true);
    expect(response.source).toBe("spacetrack");
    expect(response.data.ephemera).toHaveLength(1);
    expect(response.fetchMetadata.timestamp).toBeTruthy();
  });

  it("returns error metadata when spacetrack provides no data", async () => {
    jest.useFakeTimers();

    const loginResponse = buildLoginResponse("session=token");
    const emptyResponse = {
      json: async (): Promise<any[]> => [],
    };

    fetchWithTimeoutMock.mockImplementation(async (url: any) => {
      const asString = String(url);
      if (asString.includes("ajaxauth")) {
        return loginResponse as any;
      }
      if (asString.includes("basicspacedata")) {
        return emptyResponse as any;
      }
      throw new Error(`Unexpected URL: ${asString}`);
    });

    const promise = EphemeraService.fetchISSLocation(2000, 1, 1);
    await jest.advanceTimersByTimeAsync(2000 * 10);
    const response = await promise;

    expect(fetchWithTimeoutMock).toHaveBeenCalled();
    expect(response.fetchMetadata.success).toBe(false);
    expect(response.source).toBe("spacetrack");
    expect(response.data.ephemera).toHaveLength(0);
    expect(response.fetchMetadata.timestamp).toBeTruthy();
  });
});
