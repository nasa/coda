import express, { Request, Response } from "express";
import { fetch } from "undici";
import { getUser } from "packages/getUser";
import ConsoleLogger from "utils/logging/consoleLogger";
import serverLogger from "utils/logging/serverLogger";

/**
 * GET /api/v1/external/audiofiles/:uuid/file
 *
 * Server-to-server proxy for Talkybot audio files. The browser cannot fetch
 * Talkybot audio directly because:
 *   1. It's a cross-origin request, so it would need ORB-friendly CORS headers
 *      (Talkybot doesn't set them for restricted files).
 *   2. The browser has no Talkybot session, so restricted files would 401 even
 *      if CORS were configured.
 *
 * Instead, the CODA browser hits this proxy (same-origin, launchpad-authed at
 * nginx), and CODA's server makes the upstream call with the shared `EMSS_TOKEN`
 * (`x-api-key`), which Talkybot's `/audiofiles/:uuid/file` route honors to
 * bypass its public-only filter (see
 * `talkybot/apps/server/controllers/external.controller.ts`).
 *
 * v1 scope: any CODA-authenticated user can fetch any audio file. Per-AUID /
 * per-channel access gating is intentionally deferred — see the consumer for the
 * Talkybot `channelAccessSnapshot` S2S event when that lands.
 *
 * The Range header (and conditional headers) are forwarded so the upstream's
 * 206 Partial Content responses pass through to the browser's `<audio>` element
 * unchanged, preserving seek/skip behavior.
 *
 * The launchpad auth check at nginx (`location /api/v1/external/audiofiles`)
 * is the authoritative boundary; the `getUser` call here is defense-in-depth,
 * mirroring `routes/restricted/videos.ts`.
 */

const router = express.Router();

// Headers we forward FROM the browser TO Talkybot. Anything not in this list is
// dropped to avoid leaking CODA-specific auth (cookies, jwt) upstream.
const FORWARD_REQUEST_HEADERS = [
  "range",
  "if-range",
  "if-modified-since",
  "if-none-match",
] as const;

// Headers we forward FROM Talkybot's response TO the browser. Connection /
// transfer-encoding headers are deliberately omitted; Express/Node manage those.
const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "last-modified",
  "etag",
  "cache-control",
] as const;

router.get("/:uuid/file", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  if (user instanceof Error) {
    res.status(401).json({ status: "error", message: "Unauthorized: authentication required" });
    return;
  }

  const uuid = typeof req.params.uuid === "string" ? req.params.uuid : "";
  // Loose validation — Talkybot will reject malformed UUIDs with a 400 itself,
  // but a quick shape check avoids round-tripping obvious junk.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    res.status(400).json({ status: "error", message: "Invalid audio file uuid" });
    return;
  }

  const talkybotBaseUrl = process.env.VITE_PUBLIC_TALKYBOT_URL;
  const emssToken = process.env.EMSS_TOKEN;

  if (!talkybotBaseUrl) {
    ConsoleLogger.error(
      "external/audiofiles: VITE_PUBLIC_TALKYBOT_URL environment variable is not set"
    );
    res.status(500).json({ status: "error", message: "Server misconfiguration" });
    return;
  }
  if (!emssToken) {
    ConsoleLogger.error("external/audiofiles: EMSS_TOKEN environment variable is not set");
    res.status(500).json({ status: "error", message: "Server misconfiguration" });
    return;
  }

  const upstreamUrl = `${talkybotBaseUrl}/api/v1/external/audiofiles/${uuid}/file`;

  // Build forwarded request headers
  const upstreamHeaders: Record<string, string> = {
    "x-api-key": emssToken,
  };
  for (const headerName of FORWARD_REQUEST_HEADERS) {
    const value = req.headers[headerName];
    if (typeof value === "string") {
      upstreamHeaders[headerName] = value;
    }
  }

  // Abort the upstream fetch if the client disconnects mid-stream (e.g. user
  // seeks/skips before the file finishes). Without this, the upstream socket
  // would keep filling until the kernel closed it.
  const abortController = new AbortController();
  const onClientClose = (): void => abortController.abort();
  req.on("close", onClientClose);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: upstreamHeaders,
      signal: abortController.signal,
    });

    // Mirror status (typically 200 or 206; could be 404/416/etc.).
    res.status(upstreamResponse.status);

    // Mirror only the allowlisted response headers.
    for (const headerName of FORWARD_RESPONSE_HEADERS) {
      const value = upstreamResponse.headers.get(headerName);
      if (value !== null) {
        res.setHeader(headerName, value);
      }
    }

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      // Drain the upstream body to free the socket, but don't echo it — the
      // body may be a JSON error from Talkybot that mentions internals.
      ConsoleLogger.warn(
        `external/audiofiles: upstream returned ${upstreamResponse.status} for ${uuid}`
      );
      // Replace forwarded headers with a generic JSON error body.
      res.removeHeader("content-type");
      res.removeHeader("content-length");
      res.removeHeader("content-range");
      res.setHeader("content-type", "application/json");
      res
        .status(upstreamResponse.status === 404 ? 404 : 502)
        .json({ status: "error", message: `Upstream responded ${upstreamResponse.status}` });
      // Drain the upstream body
      if (upstreamResponse.body) {
        for await (const _chunk of upstreamResponse.body) {
          // discard
        }
      }
      return;
    }

    serverLogger.info(
      {
        logId: "talkybotAudioProxy",
        uuid,
        upstreamStatus: upstreamResponse.status,
        range: req.headers.range ?? null,
      },
      user
    );

    if (!upstreamResponse.body) {
      res.end();
      return;
    }

    // Stream the body to the client. The fetch body is a Web ReadableStream;
    // iterating it yields Uint8Array chunks which res.write accepts directly.
    for await (const chunk of upstreamResponse.body) {
      // Backpressure: if write returns false, wait for drain before continuing.
      const ok = res.write(chunk as Uint8Array);
      if (!ok) {
        await new Promise<void>((resolve) => res.once("drain", resolve));
      }
    }
    res.end();
  } catch (e) {
    // AbortError from client disconnect is expected and not actionable.
    if (e instanceof Error && e.name === "AbortError") {
      ConsoleLogger.debug(`external/audiofiles: client aborted stream for ${uuid}`);
      return;
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    ConsoleLogger.error(`external/audiofiles: error proxying ${uuid}:`, e);
    if (!res.headersSent) {
      res.status(502).json({ status: "error", message: `Error proxying audio file: ${message}` });
    } else {
      res.end();
    }
  } finally {
    req.off("close", onClientClose);
  }
});

export default router;
