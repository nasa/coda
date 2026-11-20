import { createServer, type Server } from "node:http";
import express from "express";
import { Server as SocketServer } from "socket.io";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { EmssUser } from "@emss/oauth2-proxy-common";
import { canAccessTalkybotChannel, hasTalkybotAuthorization } from "server/processing/talkybotAuth";
import {
  disconnectTalkybotS2sSocket,
  initTalkybotS2sSocket,
  retryTalkybotS2sConnection,
} from "../../talkybotS2sSocket";
import talkybotAudio from "./talkybotAudio";

vi.mock("../../sockets", () => ({ emitTalkybotS2sSocketInspectorUpdate: vi.fn() }));

const uuid = "d54bcbb7-df9a-49f9-88b2-8f35a5cab817";
const audio = Buffer.alloc(256 * 1024 + 4, "abcd");
const channelId = 2;
let coda: Server;
let upstream: SocketServer;
const audioRequest = vi.fn();
let clipExists: boolean;
let pauseBody: boolean;
let upstreamClosed: Promise<void>;
let codaUrl: string;

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server port");
  return `http://127.0.0.1:${address.port}`;
}

function publishPermissions(auids: string[]) {
  upstream.emit("channelAuthorization", [{ channelId, public: false, enabled: true, auids }]);
}

beforeEach(async () => {
  audioRequest.mockClear();
  clipExists = true;
  pauseBody = false;
  vi.stubEnv("MOCK_USER", "true");
  vi.stubEnv("MOCK_USER_AUID", "viewer");
  vi.stubEnv("MOCK_USER_ROLES", "CODA-Superuser");
  vi.stubEnv("EMSS_TOKEN", "test-key");
  const media = express();
  media.get("/api/v1/external/audiofiles/:uuid/file", (req, res) => {
    audioRequest(req.method);
    expect(req.params.uuid).toBe(uuid);
    expect(req.get("x-api-key")).toBe("test-key");
    expect(req.get("x-coda-viewer-auid")).toBeUndefined();
    expect(req.get("x-coda-viewer-superuser")).toBeUndefined();
    if (!clipExists) {
      res.sendStatus(404);
      return;
    }
    res.set({
      "X-Talkybot-Channel-Id": "2",
      "Content-Type": "audio/wav",
      "Accept-Ranges": "bytes",
      ETag: '"v3"',
    });
    if (req.headers.range === "bytes=1-2" && req.get("if-range") === '"v3"') {
      res.set("Content-Range", `bytes 1-2/${audio.length}`).status(206).send(audio.subarray(1, 3));
    } else if (req.headers.range === `bytes=${audio.length}-`) {
      res.set("Content-Range", `bytes */${audio.length}`).status(416).end();
    } else if (pauseBody) {
      upstreamClosed = new Promise<void>((resolve) => res.once("close", resolve));
      res.set("Content-Length", String(audio.length)).write(audio.subarray(0, 4));
    } else {
      res.send(audio);
    }
  });
  const upstreamServer = createServer(media);
  upstream = new SocketServer(upstreamServer, { path: "/api/v1/s2sSocketio" });
  upstream.on("connection", (socket) => {
    expect(socket.handshake.auth).toEqual({ token: "test-key", channelAuthorization: true });
    publishPermissions(["viewer"]);
  });
  vi.stubEnv("VITE_PUBLIC_TALKYBOT_URL", await listen(upstreamServer));
  initTalkybotS2sSocket();
  await vi.waitFor(() => expect(hasTalkybotAuthorization()).toBe(true));
  coda = createServer(express().use("/clip", talkybotAudio));
  codaUrl = await listen(coda);
});

afterEach(async () => {
  disconnectTalkybotS2sSocket();
  vi.unstubAllEnvs();
  coda?.close();
  coda?.closeAllConnections();
  await upstream?.close();
});

it("uses the service key for range requests and enforces viewer access in Coda", async () => {
  const url = `${codaUrl}/clip/${uuid}`;
  const headers = {
    Range: "bytes=1-2",
    "If-Range": '"v3"',
    "x-coda-viewer-auid": "other",
    "x-coda-viewer-superuser": "true",
  };
  const allowed = await fetch(url, { headers });
  expect(allowed.status).toBe(206);
  expect(allowed.headers.get("content-range")).toBe(`bytes 1-2/${audio.length}`);
  expect(allowed.headers.get("cache-control")).toBe("private, no-store");
  expect(await allowed.text()).toBe("bc");
  expect(audioRequest).toHaveBeenCalledTimes(1);

  clipExists = false;
  expect((await fetch(url, { headers })).status).toBe(404);
  clipExists = true;
  publishPermissions([]);
  await vi.waitFor(() =>
    expect(canAccessTalkybotChannel({ auid: "viewer" } as EmssUser, channelId)).toBe(false)
  );
  expect((await fetch(url, { headers })).status).toBe(404);
  expect(audioRequest).toHaveBeenCalledTimes(3);

  upstream.disconnectSockets(true);
  await vi.waitFor(() => expect(hasTalkybotAuthorization()).toBe(false));
  expect((await fetch(url, { headers })).status).toBe(503);
  expect(audioRequest).toHaveBeenCalledTimes(3);

  retryTalkybotS2sConnection();
  await vi.waitFor(() => expect(hasTalkybotAuthorization()).toBe(true));
  expect((await fetch(url, { method: "HEAD" })).status).toBe(200);
});

it("streams a full clip with one upstream GET and preserves HEAD and 416", async () => {
  const url = `${codaUrl}/clip/${uuid}`;
  const full = await fetch(url);
  expect(full.status).toBe(200);
  expect(full.headers.get("content-type")).toBe("audio/wav");
  expect(Buffer.from(await full.arrayBuffer()).equals(audio)).toBe(true);
  expect(audioRequest.mock.calls).toEqual([["GET"]]);
  const head = await fetch(url, { method: "HEAD" });
  expect(head.headers.get("content-length")).toBe(String(audio.length));
  expect(await head.text()).toBe("");

  const failed = await fetch(url, { headers: { Range: `bytes=${audio.length}-` } });
  expect(failed.status).toBe(416);
  expect(failed.headers.get("content-range")).toBe(`bytes */${audio.length}`);
  expect(audioRequest.mock.calls).toEqual([["GET"], ["HEAD"], ["GET"]]);
});

it("closes both sides of an active HTTP transfer when the socket reports a revocation", async () => {
  pauseBody = true;
  const response = await fetch(`${codaUrl}/clip/${uuid}`);
  const reader = response.body!.getReader();
  expect((await reader.read()).value).toEqual(new Uint8Array(audio.subarray(0, 4)));
  publishPermissions([]);
  await expect(reader.read()).rejects.toThrow();
  await upstreamClosed;
});
