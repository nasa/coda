import {
  getISSChannel,
  formatDateQuery,
  videoSorter,
  buildQueryArray,
  retrieveIoData,
} from "server/services/io-api";
import fetchWithTimeout from "../../utils/fetch-with-timeout";
import { collection } from "utils/consts";

jest.mock("../../utils/fetch-with-timeout");

const fetchWithTimeoutMock = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;

const createPhotoDoc = (id: string) => ({
  id,
  nasa_id: id,
  description: `description-${id}`,
  webpath: `/path/${id}`,
  file_extension_lores: "jpg",
  date_added: "2024-01-01T00:00:00Z",
  md_creation_date: "2024-01-01T00:00:00Z",
  collections_string: ["collectionRoot", `collection-${id}`],
});

const createIoResponse = (docs: any[], numfound?: number) => ({
  results: {
    response: {
      numfound: numfound ?? docs.length,
      docs,
    },
  },
});

const mockFetchResponse = (payload: any): Response =>
  ({
    json: () => Promise.resolve(payload),
  }) as unknown as Response;

describe("services/io-api", () => {
  describe("getChannel()", () => {
    it("should return a channel string when one is available", () => {
      const collectionString = [
        "P0/ISS Missions",
        "P4/ISS Missions|ISS-060",
        "P2328011/ISS Missions|ISS-060|Video",
        "P2342255/ISS Missions|ISS-060|Video|US Downlink",
        "P2344036/ISS Missions|ISS-060|Video|US Downlink|Channel 03",
        "P2344047/ISS Missions|ISS-060|Video|US Downlink|Channel 03|SD",
        "P2344048/ISS Missions|ISS-060|Video|US Downlink|Channel 03|SD|2019-08-19 to 08-23 (GMT 231 to 235)",
      ];

      expect(getISSChannel(collectionString)).toEqual("03");
    });

    it("should return an empty string when a channel is not available", () => {
      const collectionString = [
        "P0/ISS Missions",
        "P4/ISS Missions|ISS-060",
        "P2328011/ISS Missions|ISS-060|Video",
        "P2342255/ISS Missions|ISS-060|Video|US Downlink",
      ];

      expect(getISSChannel(collectionString)).toEqual("");
    });
  });

  describe("formatDateQuery()", () => {
    const dateStart = new Date("2020/01/30"); //yyyy mm dd format
    const dateEnd = new Date("2020/06/15");
    it("formats query with end date", () => {
      expect(formatDateQuery(dateStart, dateEnd)).toEqual("s_dt=01-30-2020&e_dt=06-15-2020");
    });

    it("formats query with no end date", () => {
      expect(formatDateQuery(dateStart)).toEqual("s_dt=01-30-2020&e_dt=01-30-2020");
    });
  });

  describe("videoSorter()", () => {
    const videos: VideoFile[] = Array.from({ length: 3 }, () => {
      return {
        id: null as string | null,
        description: null as string | null,
        collection: null as Collection | null,
        collections: null as string | null,
        dataURL: null as string | null,
        mediaLowResURL: null as string | null,
        start: 0,
        end: 0,
        downlink: 0,
        LOS: false,
        priority: 0,
        startDateTime: null as string | null,
      };
    });

    it("sorts priority no change", () => {
      videos[0].id = "1";
      videos[0].priority = 1;
      videos[1].id = "2";
      videos[1].priority = 2;
      videos[2].id = "3";
      videos[2].priority = 3;

      videos.sort(videoSorter);
      expect([videos[0].id, videos[1].id, videos[2].id]).toEqual(["1", "2", "3"]);
    });
    it("sorts priority resulting in backwards array", () => {
      videos[0].id = "1";
      videos[0].priority = 3;
      videos[1].id = "2";
      videos[1].priority = 2;
      videos[2].id = "3";
      videos[2].priority = 1;

      videos.sort(videoSorter);
      expect([videos[0].id, videos[1].id, videos[2].id]).toEqual(["3", "2", "1"]);
    });
    it("priority is all the same, sorts duration longest to shortest", () => {
      videos[0].id = "1";
      videos[0].priority = 1;
      videos[0].start = 1;
      videos[0].end = 1.1;

      videos[1].id = "2";
      videos[1].priority = 1;
      videos[1].start = 1;
      videos[1].end = 1.3;

      videos[2].id = "3";
      videos[2].priority = 1;
      videos[2].start = 1;
      videos[2].end = 1.2;

      videos.sort(videoSorter);
      expect([videos[0].id, videos[1].id, videos[2].id]).toEqual(["2", "3", "1"]);
    });
    it("sorts combination of priority and duration", () => {
      videos[0].id = "1";
      videos[0].priority = 2;
      videos[0].start = 1;
      videos[0].end = 1.1;

      videos[1].id = "2";
      videos[1].priority = 2;
      videos[1].start = 1;
      videos[1].end = 1.3;

      videos[2].id = "3";
      videos[2].priority = 1;
      videos[2].start = 1;
      videos[2].end = 1.1;

      videos.sort(videoSorter);
      expect([videos[0].id, videos[1].id, videos[2].id]).toEqual(["3", "2", "1"]);
    });
  });

  describe("buildQueryArray()", () => {
    it("should create 3 items in array", () => {
      expect(buildQueryArray("a=b&b=c", 4, 500)).toEqual([
        "a=b&b=c&sr=501",
        "a=b&b=c&sr=1001",
        "a=b&b=c&sr=1501",
      ]);
    });
  });

  describe("retrieveIoData()", () => {
    beforeEach(() => {
      fetchWithTimeoutMock.mockReset();
      process.env.VITE_PUBLIC_APP_ENV = "test";
      process.env.IO_API_URL = "https://io.test/search";
      process.env.IO_KEY = "unit-test-key";
      process.env.IO_HOST = "https://io.host";
    });

    it("aggregates paginated photo results", async () => {
      const firstDocs = [createPhotoDoc("A"), createPhotoDoc("B")];
      const secondDocs = [createPhotoDoc("C")];

      fetchWithTimeoutMock.mockResolvedValueOnce(
        mockFetchResponse(createIoResponse(firstDocs, 501))
      );
      fetchWithTimeoutMock.mockResolvedValueOnce(mockFetchResponse(createIoResponse(secondDocs)));

      const results = await retrieveIoData({
        collection: collection.ISS,
        fetchType: "photos",
        requestedDate: new Date("2024-01-02T00:00:00Z"),
      });

      expect(results.map((photo) => photo.id)).toEqual(["A", "B", "C"]);
      expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(2);
      expect(fetchWithTimeoutMock.mock.calls[1]?.[0]).toContain("&sr=501");
    });
  });
});
