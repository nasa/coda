import { vi } from "vitest";
import type { Mock } from "vitest";
import { getAncillaryDataSourceList } from "server/processing/ancillaryDataSources";
import fetchWithTimeout from "utils/fetch-with-timeout";
import getGraphManifest from "./graphs";

vi.mock("server/processing/ancillaryDataSources");
vi.mock("utils/fetch-with-timeout");

const mockGetAncillaryDataSourceList = getAncillaryDataSourceList as Mock;
const mockFetchWithTimeout = fetchWithTimeout as Mock;

describe("graphs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGraphManifest", () => {
    it("should successfully fetch and return graph manifest", async () => {
      const mockManifest: GraphsManifest = {
        /* mock data */
      } as GraphsManifest;
      const source: Source = "source1" as Source;
      const dateWanted = "2024-01-01";

      mockGetAncillaryDataSourceList.mockResolvedValue([
        {
          date: "2024-01-01",
          source,
          type: "graphs",
          url: "https://example.com/manifest.json",
        } as AncillaryDataSource,
      ]);

      const mockResponse = {
        json: vi.fn().mockResolvedValue(mockManifest),
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse as unknown as Response);

      const result = await getGraphManifest({ source, dateWanted });

      expect(result.fetchMetadata.success).toBe(true);
      expect(result.data).toEqual(mockManifest);
    });

    it("should return null data when no matching ancillary source exists", async () => {
      mockGetAncillaryDataSourceList.mockResolvedValue([]);

      const result = await getGraphManifest({
        source: "source1" as Source,
        dateWanted: "2024-01-01",
      });

      expect(result.fetchMetadata.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("should handle fetch errors and return error message", async () => {
      const errorMessage = "Network error";

      mockGetAncillaryDataSourceList.mockResolvedValue([
        {
          date: "2024-01-01",
          source: "source1" as Source,
          type: "graphs",
          url: "https://example.com/manifest.json",
        } as AncillaryDataSource,
      ]);

      mockFetchWithTimeout.mockRejectedValue(new Error(errorMessage));

      const result = await getGraphManifest({
        source: "source1" as Source,
        dateWanted: "2024-01-01",
      });

      expect(result.fetchMetadata.success).toBe(false);
      expect(result.fetchMetadata.error).toBe(errorMessage);
      expect(result.data).toBeNull();
    });

    it("should handle non-Error thrown exceptions", async () => {
      mockGetAncillaryDataSourceList.mockResolvedValue([
        {
          date: "2024-01-01",
          source: "source1" as Source,
          type: "graphs",
          url: "https://example.com/manifest.json",
        } as AncillaryDataSource,
      ]);

      mockFetchWithTimeout.mockRejectedValue("Unknown error");

      const result = await getGraphManifest({
        source: "source1" as Source,
        dateWanted: "2024-01-01",
      });

      expect(result.fetchMetadata.success).toBe(false);
      expect(result.fetchMetadata.error).toBe("Unable to load graphs manifest");
    });
  });
});
