import { vi } from "vitest";
import type { Mock } from "vitest";
import { fetchMTXHlsEndpoints } from "./mediaMtx-hls";

describe("mediaMtx-hls", () => {
  describe("fetchMTXHlsEndpoints", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
      process.env.MEDIAMTX_USERNAME = "testuser";
      process.env.MEDIAMTX_PASSWORD = "testpass";
      process.env.VITE_PUBLIC_MEDIA_MTX_CONTROL_URL = "http://localhost:9997/";
      process.env.VITE_PUBLIC_MEDIA_MTX_HLS_URL = "http://localhost:8888/";
      process.env.HLS_BUFFER_DURATION_SECONDS = "900";
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should fetch HLS endpoints for specified source", async () => {
      const mockPathsResponse = {
        items: [
          { name: "DL1_ISS", ready: true },
          { name: "DL2_ISS", ready: true },
          { name: "DL1_TE", ready: true },
        ],
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        json: async () => mockPathsResponse,
      });

      const result = await fetchMTXHlsEndpoints({ sourceAbbr: "ISS" });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("DL1_ISS");
      expect(result[1].name).toBe("DL2_ISS");
      expect(result[0].secondsAvailable).toBe(900);
      expect(result[1].secondsAvailable).toBe(900);
    });

    it("should filter by source abbreviation", async () => {
      const mockPathsResponse = {
        items: [
          { name: "DL1_ISS", ready: true },
          { name: "DL2_TE", ready: true },
          { name: "DL3_TE", ready: true },
        ],
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        json: async () => mockPathsResponse,
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

      (global.fetch as Mock).mockResolvedValueOnce({
        json: async () => mockPathsResponse,
      });

      const result = await fetchMTXHlsEndpoints({ sourceAbbr: "ISS" });

      expect(result).toHaveLength(2);
      expect(result.find((e) => e.name === "DL2_ISS")).toBeUndefined();
    });

    it("should use configured HLS buffer duration for each endpoint", async () => {
      const mockPathsResponse = {
        items: [{ name: "DL1_ISS", ready: true }],
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        json: async () => mockPathsResponse,
      });

      // Use default configured duration (900 seconds = 15 minutes)
      const result = await fetchMTXHlsEndpoints({ sourceAbbr: "ISS" });

      expect(result).toHaveLength(1);
      expect(result[0].secondsAvailable).toBe(900);
    });

    it("should use custom HLS buffer duration from env var", async () => {
      process.env.HLS_BUFFER_DURATION_SECONDS = "600";

      const mockPathsResponse = {
        items: [{ name: "DL1_ISS", ready: true }],
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        json: async () => mockPathsResponse,
      });

      const result = await fetchMTXHlsEndpoints({ sourceAbbr: "ISS" });

      expect(result).toHaveLength(1);
      expect(result[0].secondsAvailable).toBe(600);

      // Clean up
      delete process.env.HLS_BUFFER_DURATION_SECONDS;
    });

    it("should use Basic auth header", async () => {
      const mockPathsResponse: { items: Array<{ name: string; ready: boolean }> } = {
        items: [],
      };

      (global.fetch as Mock).mockResolvedValueOnce({
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
