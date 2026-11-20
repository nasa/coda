import type { EmssUser } from "@emss/oauth2-proxy-common";
import type { Socket } from "socket.io";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fetchWithTimeout from "utils/fetch-with-timeout";
import { getApplicableMediaOverrides } from "server/processing/mediaOverrideResolver";
import { setTalkybotChannelAuthorization } from "server/processing/talkybotAuth";
import {
  deliverTalkybotClip,
  refreshTalkybotViews,
  removeTalkybotView,
  setTalkybotView,
} from "./talkybotDelivery";

vi.mock("utils/fetch-with-timeout", () => ({ default: vi.fn() }));
vi.mock("server/processing/mediaOverrideResolver", () => ({
  getApplicableMediaOverrides: vi.fn(),
}));

type ViewerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
const socketIds: string[] = [];
const firstDate = "2026-11-17";
const secondDate = "2026-11-18";
const group = { id: 1, slug: "artemis", name: "Artemis" };
const channel = { id: 2, slug: "xpl-fd", name: "XPL FD", groups: [group] };

function publishPermissions(auids: string[]) {
  setTalkybotChannelAuthorization([{ channelId: channel.id, public: false, enabled: true, auids }]);
  refreshTalkybotViews();
}

function clip(uuid: string, date: string, sim: boolean): TbAudioFileNative {
  const time = `${date}T13:30:00.000Z`;
  return {
    uuid,
    version: 1,
    added: time,
    updated: time,
    startTime: time,
    deleted: false,
    channel: { ...channel, sim },
  };
}

function openView(auid: string, source: Source, dateViewing: string) {
  const socket = { id: String(socketIds.length), emit: vi.fn() };
  socketIds.push(socket.id);
  const user = { auid, roles: [] } as unknown as EmssUser;
  setTalkybotView(socket as unknown as ViewerSocket, user, { source, dateViewing });
  return socket.emit;
}

describe("Coda Talkybot delivery", () => {
  beforeEach(() => {
    publishPermissions(["allowed"]);
    vi.mocked(getApplicableMediaOverrides).mockResolvedValue([]);
    vi.stubEnv("EMSS_TOKEN", "service-key");
    vi.stubEnv("VITE_PUBLIC_TALKYBOT_URL", "https://talkybot.test");
    vi.mocked(fetchWithTimeout).mockImplementation(async (url, init) => {
      const date = new URL(url).searchParams.get("date");
      expect(new URL(url).searchParams.get("includeRestricted")).toBe("true");
      expect(init?.headers).toEqual({ "x-api-key": "service-key" });
      const files =
        date === firstDate
          ? [clip("mission-history", firstDate, false)]
          : [clip("sim-history", secondDate, true)];
      const hidden = clip("hidden-history", date!, date === secondDate);
      hidden.channel = { ...hidden.channel, id: 99 };
      return Response.json({ audioFiles: [...files, hidden] });
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    socketIds.splice(0).forEach(removeTalkybotView);
    setTalkybotChannelAuthorization(null);
  });

  it("routes the same XPL loop by recording date and filters history and live data by viewer", async () => {
    const mission = openView("allowed", "ARTEMIS", firstDate);
    const sim = openView("allowed", "TEST_EVENTS", secondDate);
    const wrongSource = openView("allowed", "ARTEMIS", secondDate);
    const denied = openView("denied", "TEST_EVENTS", secondDate);

    await vi.waitFor(() => {
      for (const [emit, ids] of [
        [mission, ["mission-history"]],
        [sim, ["sim-history"]],
        [wrongSource, []],
        [denied, []],
      ] as const) {
        expect(emit).toHaveBeenCalledWith(
          "dataUpdate",
          expect.objectContaining({
            response: expect.objectContaining({
              data: ids.map((fileUuid) => expect.objectContaining({ fileUuid, restricted: true })),
            }),
          })
        );
      }
    });

    const live = clip("sim-live", secondDate, true);
    deliverTalkybotClip(live);
    expect(sim).toHaveBeenCalledWith(
      "incrementalDataUpdate",
      expect.objectContaining({ item: expect.objectContaining({ fileUuid: live.uuid }) })
    );
    for (const emit of [mission, wrongSource, denied]) {
      expect(emit.mock.calls.some(([event]) => event === "incrementalDataUpdate")).toBe(false);
    }

    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(Response.json({ audioFiles: [live] }));
    const reopened = openView("allowed", "TEST_EVENTS", secondDate);
    await vi.waitFor(() =>
      expect(reopened).toHaveBeenCalledWith(
        "dataUpdate",
        expect.objectContaining({
          response: expect.objectContaining({
            data: [expect.objectContaining({ fileUuid: live.uuid })],
          }),
        })
      )
    );

    publishPermissions(["denied"]);
    expect(sim).toHaveBeenCalledWith("talkybotClipRemoved", live.uuid);
    sim.mockClear();
    const later = clip("later-live", secondDate, true);
    deliverTalkybotClip(later);
    expect(sim).not.toHaveBeenCalled();
    expect(denied).toHaveBeenCalledWith(
      "incrementalDataUpdate",
      expect.objectContaining({ item: expect.objectContaining({ fileUuid: later.uuid }) })
    );
    const refreshed = openView("allowed", "TEST_EVENTS", secondDate);
    await vi.waitFor(() =>
      expect(refreshed).toHaveBeenCalledWith(
        "dataUpdate",
        expect.objectContaining({ response: expect.objectContaining({ data: [] }) })
      )
    );
    refreshed.mockClear();
    deliverTalkybotClip(clip("after-refresh", secondDate, true));
    expect(refreshed).not.toHaveBeenCalled();
  });
  it("retains legacy transcript-only overrides while Talkybot access is unavailable", async () => {
    setTalkybotChannelAuthorization(null);
    vi.mocked(getApplicableMediaOverrides).mockImplementation(async ({ type }) =>
      type === "transcript"
        ? [
            {
              url: "https://legacy.test/comm",
              date: secondDate,
              matchMode: "exact",
              source: "TEST_EVENTS",
              type,
            },
          ]
        : []
    );
    vi.mocked(fetchWithTimeout).mockImplementation(async (url) =>
      url.endsWith("transcript-SG1.json")
        ? Response.json([[20, "", "Legacy transcript"]])
        : new Response(null, { status: 404 })
    );
    const emit = openView("allowed", "TEST_EVENTS", secondDate);
    await vi.waitFor(() =>
      expect(emit).toHaveBeenCalledWith(
        "dataUpdate",
        expect.objectContaining({
          response: expect.objectContaining({
            data: [
              expect.objectContaining({
                override: true,
                duration: 0,
                text: "Legacy transcript",
                audioUrl: undefined,
              }),
            ],
          }),
        })
      )
    );
  });
});
