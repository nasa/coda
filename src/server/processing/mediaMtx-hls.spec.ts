import { fetchMTXHlsEndpoints } from "./mediaMtx-hls";

describe("mediaMtx-hls", () => {
  describe("fetchMTXHlsEndpoints", () => {
    beforeEach(() => {
      global.fetch = jest.fn();
      process.env.MEDIAMTX_USERNAME = "testuser";
      process.env.MEDIAMTX_PASSWORD = "testpass";
      process.env.VITE_PUBLIC_MEDIA_MTX_CONTROL_URL = "http://localhost:9997/";
      process.env.VITE_PUBLIC_MEDIA_MTX_HLS_URL = "http://localhost:8888/";
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should fetch HLS endpoints for specified source", async () => {
      const mockPathsResponse = {
        items: [
          { name: "DL1_ISS", ready: true },
          { name: "DL2_ISS", ready: true },
          { name: "DL1_TE", ready: true },
        ],
      };

      const mockIndexM3u8 = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000
stream.m3u8`;

      const mockStreamM3u8 = `#EXTM3U
#EXTINF:10.0,
segment1.ts`;

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          json: async () => mockPathsResponse,
        })
        .mockResolvedValue({
          text: async () => mockIndexM3u8,
        })
        .mockResolvedValue({
          text: async () => mockStreamM3u8,
        });

      const result = await fetchMTXHlsEndpoints({ sourceAbbr: "ISS" });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("DL1_ISS");
      expect(result[1].name).toBe("DL2_ISS");
    });

    it("should filter by source abbreviation", async () => {
      const mockPathsResponse = {
        items: [
          { name: "DL1_ISS", ready: true },
          { name: "DL2_TE", ready: true },
          { name: "DL3_TE", ready: true },
        ],
      };

      const mockIndexM3u8 = `#EXTM3U
stream.m3u8`;
      const mockStreamM3u8 = `#EXTM3U
#EXTINF:5.0,
segment1.ts`;

      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes("v3/paths/list")) {
          return Promise.resolve({ json: async () => mockPathsResponse });
        }
        if (url.includes("index.m3u8")) {
          return Promise.resolve({ text: async () => mockIndexM3u8 });
        }
        return Promise.resolve({ text: async () => mockStreamM3u8 });
      });

      const result = await fetchMTXHlsEndpoints({ sourceAbbr: "TE" });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("DL2_TE");
      expect(result[1].name).toBe("DL3_TE");
    });

    it("should only include ready streams", async () => {
      const mockPathsResponse = {
        items: [
          { name: "DL1_ISS", ready: true },
          { name: "DL2_ISS", ready: false },
          { name: "DL3_ISS", ready: true },
        ],
      };

      const mockIndexM3u8 = `#EXTM3U
stream.m3u8`;
      const mockStreamM3u8 = `#EXTM3U
#EXTINF:10.0,
segment1.ts`;

      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes("v3/paths/list")) {
          return Promise.resolve({ json: async () => mockPathsResponse });
        }
        if (url.includes("index.m3u8")) {
          return Promise.resolve({ text: async () => mockIndexM3u8 });
        }
        return Promise.resolve({ text: async () => mockStreamM3u8 });
      });

      const result = await fetchMTXHlsEndpoints({ sourceAbbr: "ISS" });

      expect(result).toHaveLength(2);
      expect(result.find((e) => e.name === "DL2_ISS")).toBeUndefined();
    });

    it("should include duration for each endpoint", async () => {
      const mockPathsResponse = {
        items: [{ name: "DL1_ISS", ready: true }],
      };

      const mockIndexM3u8 = `#EXTM3U
stream.m3u8`;
      const mockStreamM3u8 = `#EXTM3U
#EXTINF:15.5,
segment1.ts
#EXTINF:20.3,
segment2.ts`;

      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes("v3/paths/list")) {
          return Promise.resolve({ json: async () => mockPathsResponse });
        }
        if (url.includes("index.m3u8")) {
          return Promise.resolve({ text: async () => mockIndexM3u8 });
        }
        return Promise.resolve({ text: async () => mockStreamM3u8 });
      });

      const result = await fetchMTXHlsEndpoints({ sourceAbbr: "ISS" });

      expect(result).toHaveLength(1);
      expect(result[0].secondsAvailable).toBeCloseTo(35.8, 1);
    });

    it("should use Basic auth header", async () => {
      const mockPathsResponse: { items: Array<{ name: string; ready: boolean }> } = {
        items: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockPathsResponse,
      });

      await fetchMTXHlsEndpoints({ sourceAbbr: "ISS" });

      const expectedAuth = `Basic ${Buffer.from("testuser:testpass").toString("base64")}`;

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:9997/v3/paths/list",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expectedAuth,
          }),
        })
      );
    });
  });
});
