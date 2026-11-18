import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import talkybotAudio from "./talkybotAudio";

const uuid = "d54bcbb7-df9a-49f9-88b2-8f35a5cab817";
let coda: Server;
let upstream: Server;
let codaUrl: string;
let granted: boolean;

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server port");
  return `http://127.0.0.1:${address.port}`;
}

beforeEach(async () => {
  granted = true;
  vi.stubEnv("MOCK_USER", "true");
  vi.stubEnv("MOCK_USER_AUID", "viewer");
  vi.stubEnv("MOCK_USER_ROLES", "CODA-Superuser");
  vi.stubEnv("EMSS_TOKEN", "test-key");
  upstream = createServer((req, res) => {
    if (
      req.url !== `/api/v1/external/audiofiles/${uuid}/service-file` ||
      req.headers["x-api-key"] !== "test-key" ||
      req.headers["x-coda-viewer-auid"] !== "viewer" ||
      req.headers["x-coda-viewer-superuser"] !== "false"
    ) {
      res.writeHead(403).end();
      return;
    }
    if (!granted) {
      res.writeHead(404).end();
      return;
    }
    expect(req.headers.range).toBe("bytes=1-2");
    res.writeHead(206, {
      "content-range": "bytes 1-2/4",
      "content-type": "audio/wav",
      "content-length": "2",
    });
    res.end(Buffer.from([2, 3]));
  });
  vi.stubEnv("VITE_PUBLIC_TALKYBOT_URL", await listen(upstream));
  coda = createServer(express().use("/clip", talkybotAudio));
  codaUrl = await listen(coda);
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const server of [coda, upstream]) {
    server.close();
    server.closeAllConnections();
  }
});

it("streams a byte range using the signed-in viewer and respects Talkybot access", async () => {
  const url = `${codaUrl}/clip/${uuid}`;
  const headers = { Range: "bytes=1-2" };
  const allowed = await fetch(url, { headers });
  expect(allowed.status).toBe(206);
  expect(allowed.headers.get("content-range")).toBe("bytes 1-2/4");
  expect(allowed.headers.get("cache-control")).toBe("private, no-store");
  expect(new Uint8Array(await allowed.arrayBuffer())).toEqual(new Uint8Array([2, 3]));

  granted = false;
  expect((await fetch(url, { headers })).status).toBe(404);
});
