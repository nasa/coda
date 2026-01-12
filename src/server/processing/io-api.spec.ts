import { vi } from "vitest";
import type { Mock } from "vitest";
import {
  getISSChannel,
  formatDateQuery,
  videoSorter,
  buildQueryArray,
  fetchIoData,
  isDownlinkVideo,
} from "server/processing/io-api";
import fetchWithTimeout from "../../utils/fetch-with-timeout";
import { collection } from "utils/consts";

vi.mock("../../utils/fetch-with-timeout");

const fetchWithTimeoutMock = fetchWithTimeout as Mock;

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

const createIoResponse = (docs: unknown[], numfound?: number) => ({
  results: {
    response: {
      numfound: numfound ?? docs.length,
      docs,
    },
  },
});

const mockFetchResponse = (payload: unknown): Response =>
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

  describe("isDownlinkVideo()", () => {
    /**
     * NASA ID format: iss<exp>m<source><day><time> or sts<mission>m<source><day><time>
     * Where:
     *   - iss/sts = mission type prefix
     *   - <exp> = zero-padded expedition/mission number (e.g., 060)
     *   - m = literal 'm' for moving imagery (video)
     *   - <source> = video source ID (2 digits, 01-99)
     *     - First digit: 0-4 = realtime, 5 = LOS (Loss of Signal)
     *     - Second digit: channel number
     *   - <day> = GMT day (3 digits)
     *   - <time> = GMT start time (4 digits)
     *
     * Example: iss060m012311234
     *   - iss = ISS mission
     *   - 060 = Expedition 60
     *   - m = moving imagery
     *   - 01 = SD Downlink channel 1 (realtime)
     *   - 231 = GMT day 231
     *   - 1234 = start time 12:34 GMT
     */

    describe("SD Downlink (source IDs 01-10)", () => {
      // iss060m012311234: source ID "01" = SD Downlink channel 1
      it("should return true for SD Downlink channel 01", () => {
        expect(isDownlinkVideo("iss060m012311234")).toBe(true);
      });

      // iss060m052311234: source ID "05" = SD Downlink channel 5
      it("should return true for SD Downlink channel 05", () => {
        expect(isDownlinkVideo("iss060m052311234")).toBe(true);
      });

      // iss060m102311234: source ID "10" = SD Downlink channel 10 (upper bound)
      it("should return true for SD Downlink channel 10", () => {
        expect(isDownlinkVideo("iss060m102311234")).toBe(true);
      });

      it("should handle IDs with letters in the 7th position (e.g. 'm' for LOS)", () => {
        expect(isDownlinkVideo("iss060m01231234")).toBe(true);
      });
    });

    describe("HD Downlink (source IDs 11-20)", () => {
      // iss060m112311234: source ID "11" = HD Downlink channel 1
      it("should return true for HD Downlink channel 11", () => {
        expect(isDownlinkVideo("iss060m112311234")).toBe(true);
      });

      // iss060m152311234: source ID "15" = HD Downlink channel 5
      it("should return true for HD Downlink channel 15", () => {
        expect(isDownlinkVideo("iss060m152311234")).toBe(true);
      });

      // iss060m202311234: source ID "20" = HD Downlink channel 10 (upper bound)
      it("should return true for HD Downlink channel 20", () => {
        expect(isDownlinkVideo("iss060m202311234")).toBe(true);
      });
    });

    describe("Russian Downlink (source ID 31)", () => {
      // iss060m312311234: source ID "31" = Russian Downlink
      it("should return true for Russian Downlink", () => {
        expect(isDownlinkVideo("iss060m312311234")).toBe(true);
      });
    });

    describe("Shuttle Downlink (source ID 60)", () => {
      // sts120m602311234: STS-120 mission, source ID "60" = Shuttle Downlink
      it("should return true for Shuttle Downlink", () => {
        expect(isDownlinkVideo("sts120m602311234")).toBe(true);
      });
    });

    describe("non-downlink sources", () => {
      // iss060m212311234: source ID "21" = SD Onboards (not downlink)
      it("should return false for SD Onboards (21)", () => {
        expect(isDownlinkVideo("iss060m212311234")).toBe(false);
      });

      // iss060m222311234: source ID "22" = HD Onboards (not downlink)
      it("should return false for HD Onboards (22)", () => {
        expect(isDownlinkVideo("iss060m222311234")).toBe(false);
      });

      // iss060m232311234: source ID "23" = Hi-8 mm Onboards (not downlink)
      it("should return false for Hi-8 mm Onboards (23)", () => {
        expect(isDownlinkVideo("iss060m232311234")).toBe(false);
      });

      // iss060m242311234: source ID "24" = MPC (not downlink)
      it("should return false for MPC (24)", () => {
        expect(isDownlinkVideo("iss060m242311234")).toBe(false);
      });

      // iss060m262311234: source ID "26" = NASA TV (not downlink)
      it("should return false for NASA TV (26)", () => {
        expect(isDownlinkVideo("iss060m262311234")).toBe(false);
      });

      // iss060m282311234: source ID "28" = HDEV (not downlink)
      it("should return false for HDEV (28)", () => {
        expect(isDownlinkVideo("iss060m282311234")).toBe(false);
      });

      // iss060m322311234: source ID "32" = ISS MPEG Encoder (not downlink)
      it("should return false for ISS MPEG Encoder (32)", () => {
        expect(isDownlinkVideo("iss060m322311234")).toBe(false);
      });

      // iss060m332311234: source ID "33" = FCR Camera 1 (not downlink)
      it("should return false for FCR Camera 1 (33)", () => {
        expect(isDownlinkVideo("iss060m332311234")).toBe(false);
      });

      // iss060m412311234: source ID "41" = SD JAXA Live Video (not downlink)
      it("should return false for SD JAXA Live Video (41)", () => {
        expect(isDownlinkVideo("iss060m412311234")).toBe(false);
      });

      // iss060m452311234: source ID "45" = Digital Imagery Files (not downlink)
      it("should return false for Digital Imagery Files (45)", () => {
        expect(isDownlinkVideo("iss060m452311234")).toBe(false);
      });

      // iss060m002311234: source ID "00" is not a valid downlink (downlink starts at 01)
      it("should return false for source ID 00", () => {
        expect(isDownlinkVideo("iss060m002311234")).toBe(false);
      });

      // iss060m652311234: source ID "65" = Engineering Views KSC (not downlink)
      it("should return false for Engineering Views KSC (65)", () => {
        expect(isDownlinkVideo("iss060m652311234")).toBe(false);
      });

      // iss060m712311234: source ID "71" = HD JAXA Live Video (not downlink)
      it("should return false for HD JAXA Live Video (71)", () => {
        expect(isDownlinkVideo("iss060m712311234")).toBe(false);
      });

      // iss060m752311234: source ID "75" = ISS Pre-Flight Hardware Closeout (not downlink)
      it("should return false for ISS Pre-Flight Hardware Closeout (75)", () => {
        expect(isDownlinkVideo("iss060m752311234")).toBe(false);
      });

      // iss060m802311234: source ID "80" = Commercial Spacecraft (not downlink)
      it("should return false for Commercial Spacecraft (80)", () => {
        expect(isDownlinkVideo("iss060m802311234")).toBe(false);
      });

      // iss060m852311234: source ID "85" = ATV/HTV Video (not downlink)
      it("should return false for ATV/HTV Video (85)", () => {
        expect(isDownlinkVideo("iss060m852311234")).toBe(false);
      });

      // iss060m912311234: source ID "91" = GVS HD Video (not downlink)
      it("should return false for GVS HD Video (91)", () => {
        expect(isDownlinkVideo("iss060m912311234")).toBe(false);
      });
    });

    describe("edge cases", () => {
      // "invalid-id" doesn't match pattern iss<exp>m<source><day><time>
      it("should return false for invalid NASA ID format", () => {
        expect(isDownlinkVideo("invalid-id")).toBe(false);
      });

      // Empty string doesn't match pattern
      it("should return false for empty string", () => {
        expect(isDownlinkVideo("")).toBe(false);
      });

      // sts120m052311234: STS prefix should work the same as ISS
      it("should handle STS mission IDs", () => {
        expect(isDownlinkVideo("sts120m052311234")).toBe(true);
      });

      // ISS060m052311234: uppercase ISS should match (case-insensitive)
      it("should handle case-insensitive ISS prefix", () => {
        expect(isDownlinkVideo("ISS060m052311234")).toBe(true);
      });

      // STS120m052311234: uppercase STS should match (case-insensitive)
      it("should handle case-insensitive STS prefix", () => {
        expect(isDownlinkVideo("STS120m052311234")).toBe(true);
      });

      // IDs without 'm' marker should not match (old format)
      it("should return false for NASA IDs without 'm' marker", () => {
        expect(isDownlinkVideo("iss060012311234")).toBe(false);
      });
    });

    describe("GVS and other 5x source IDs (not downlink)", () => {
      // iss060m512311234: source ID "51" = GVS SD Video (not downlink per spec)
      it("should return false for GVS SD Video (51)", () => {
        expect(isDownlinkVideo("iss060m512311234")).toBe(false);
      });

      // iss060m532311234: source ID "53" = GVS SD Video
      it("should return false for GVS SD Video (53)", () => {
        expect(isDownlinkVideo("iss060m532311234")).toBe(false);
      });

      // iss060m592311234: source ID "59" = GVS SD Video (upper bound)
      it("should return false for GVS SD Video (59)", () => {
        expect(isDownlinkVideo("iss060m592311234")).toBe(false);
      });
    });
  });

  describe("retrieveIoData()", () => {
    beforeEach(() => {
      fetchWithTimeoutMock.mockReset();
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

      const results = await fetchIoData({
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
