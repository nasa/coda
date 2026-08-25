import { beforeEach, describe, expect, it, vi } from "vitest";
import fetchWithTimeout from "utils/fetch-with-timeout";
import { getApplicableMediaOverrides } from "server/processing/mediaOverrideResolver";
import getCommOverrides from "./commOverrides";

vi.mock("utils/fetch-with-timeout");
vi.mock("server/processing/mediaOverrideResolver", () => ({
  getApplicableMediaOverrides: vi.fn(),
}));

const getApplicableMediaOverridesMock = vi.mocked(getApplicableMediaOverrides);
const fetchWithTimeoutMock = vi.mocked(fetchWithTimeout);

describe("getCommOverrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses resolved public daily audio and transcript override URLs", async () => {
    getApplicableMediaOverridesMock.mockImplementation(async ({ type }) => {
      if (type === "audio") {
        return [
          {
            id: 1,
            date: "2026-08-01",
            source: "TEST_EVENTS",
            type: "audio",
            matchMode: "daily",
            url: "https://media.example.test/2026-08-25",
            accessGrantId: null,
          },
        ];
      }
      return [
        {
          id: 2,
          date: "2026-08-01",
          source: "TEST_EVENTS",
          type: "transcript",
          matchMode: "daily",
          url: "https://transcripts.example.test/2026-08-25",
          accessGrantId: null,
        },
      ];
    });
    fetchWithTimeoutMock.mockImplementation(async (url) => {
      const value = String(url);
      if (value.endsWith("audioManifest.json")) {
        return {
          json: async () => [],
        } as Response;
      }
      return {
        json: async () => [],
      } as Response;
    });

    await getCommOverrides({ source: "TEST_EVENTS", dateWanted: "2026-08-25" });

    expect(getApplicableMediaOverridesMock).toHaveBeenCalledWith({
      source: "TEST_EVENTS",
      type: "audio",
      requestedDate: "2026-08-25",
      visibility: "public",
    });
    expect(getApplicableMediaOverridesMock).toHaveBeenCalledWith({
      source: "TEST_EVENTS",
      type: "transcript",
      requestedDate: "2026-08-25",
      visibility: "public",
    });
    expect(fetchWithTimeoutMock).toHaveBeenCalledWith(
      "https://media.example.test/2026-08-25/audioManifest.json"
    );
    expect(fetchWithTimeoutMock).toHaveBeenCalledWith(
      "https://transcripts.example.test/2026-08-25/transcript-SG1.json"
    );
  });

  it("does not query overrides for ISS", async () => {
    const response = await getCommOverrides({ source: "ISS", dateWanted: "2026-08-25" });

    expect(response.data).toEqual([]);
    expect(getApplicableMediaOverridesMock).not.toHaveBeenCalled();
    expect(fetchWithTimeoutMock).not.toHaveBeenCalled();
  });
});
