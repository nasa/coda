import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import { Router } from "express";
import { getUser } from "packages/getUser";
import {
  canAccessTalkybotChannel,
  hasTalkybotAuthorization,
  trackTalkybotPlayback,
  type TalkybotPlayback,
} from "server/processing/talkybotAuth";
import fetchWithTimeout from "utils/fetch-with-timeout";

const router = Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get("/:uuid", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const user = getUser(req);
  if (user instanceof Error || !user.auid) {
    res.sendStatus(401);
    return;
  }
  if (!uuidPattern.test(req.params.uuid)) {
    res.sendStatus(400);
    return;
  }
  const baseUrl = process.env.VITE_PUBLIC_TALKYBOT_URL;
  const token = process.env.EMSS_TOKEN;
  if (!baseUrl || !token || !hasTalkybotAuthorization()) {
    res.sendStatus(503);
    return;
  }
  const upstreamUrl = new URL(`/api/v1/external/audiofiles/${req.params.uuid}/file`, baseUrl);
  const controller = new AbortController();
  res.on("close", () => controller.abort());

  const headers: Record<string, string> = { "x-api-key": token };
  if (req.headers.range) headers.range = req.headers.range;
  const ifRange = req.get("if-range");
  if (ifRange) headers["if-range"] = ifRange;

  const playback: TalkybotPlayback = { uuid: req.params.uuid.toLowerCase(), user, controller };
  const untrack = trackTalkybotPlayback(playback);
  try {
    const upstream = await fetchWithTimeout(upstreamUrl.href, {
      headers,
      method: req.method,
      redirect: "error",
      signal: controller.signal,
    });
    if (res.destroyed || controller.signal.aborted) {
      await upstream.body?.cancel();
      if (!res.destroyed) res.sendStatus(404);
      return;
    }
    if (![200, 206, 416].includes(upstream.status)) {
      await upstream.body?.cancel();
      res.sendStatus(upstream.status === 404 ? 404 : 502);
      return;
    }

    const channelId = Number(upstream.headers.get("x-talkybot-channel-id"));
    if (
      !Number.isSafeInteger(channelId) ||
      channelId <= 0 ||
      !canAccessTalkybotChannel(user, channelId)
    ) {
      await upstream.body?.cancel();
      res.sendStatus(404);
      return;
    }
    playback.channelId = channelId;

    for (const header of [
      "accept-ranges",
      "content-length",
      "content-range",
      "content-type",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.status(upstream.status);
    if (upstream.status === 416 || !upstream.body) {
      await upstream.body?.cancel();
      if (upstream.status === 416) res.removeHeader("content-length");
      res.end();
      return;
    }

    await pipeline(Readable.fromWeb(upstream.body as ReadableStream<Uint8Array>), res, {
      signal: controller.signal,
    });
  } catch (error) {
    if (!res.destroyed) {
      if (res.headersSent) res.destroy(error instanceof Error ? error : undefined);
      else res.sendStatus(502);
    }
  } finally {
    untrack();
  }
});

export default router;
