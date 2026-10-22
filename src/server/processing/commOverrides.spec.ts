import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps Labs wildcard media URLs when Talkybot points to production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITE_PUBLIC_TALKYBOT_URL", "https://talkybot.fit.nasa.gov");
    const { resolveApplicableMediaOverrides } =
      await vi.importActual<typeof import("./mediaOverrideResolver")>("./mediaOverrideResolver");
    const template = "https://emss-labs.fit.nasa.gov/sim/{date}";
    getApplicableMediaOverridesMock.mockImplementation(async ({ type, requestedDate }) =>
      resolveApplicableMediaOverrides(
        [
          {
            id: 1,
            date: "2026-08-01",
            source: "TEST_EVENTS",
            type,
            matchMode: "daily",
            url: template,
            accessGrantId: null,
          },
        ],
        requestedDate
      )
    );
    fetchWithTimeoutMock.mockImplementation(
      async (url) =>
        ({
          json: async () =>
            String(url).endsWith("audioManifest.json")
              ? [
                  {
                    start_seconds: 3600,
                    cue_start_seconds: 0,
                    cue_end_seconds: 10,
                    sgChannels: [
                      {
                        sgChannel: 1,
                        activity_ranges: [
                          {
                            sound_start_secs: 0,
                            sound_stop_secs: 10,
                            aacSegmentFilename: "sim.aac",
                          },
                        ],
                      },
                    ],
                  },
                ]
              : String(url).endsWith("transcript-SG1.json")
                ? [[3601, "crew", "Sim check"]]
                : [],
        }) as Response
    );

    const response = await getCommOverrides({ source: "TEST_EVENTS", dateWanted: "2026-10-22" });

    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({
      override: true,
      text: "Sim check",
      duration: 10,
      audioUrl: "https://emss-labs.fit.nasa.gov/sim/2026-10-22/audio/sim.aac",
    });
    expect(fetchWithTimeoutMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://emss-labs.fit.nasa.gov/sim/2026-10-22/audioManifest.json",
      ...[1, 2, 3, 4].map(
        (channel) => `https://emss-labs.fit.nasa.gov/sim/2026-10-22/transcript-SG${channel}.json`
      ),
    ]);
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
