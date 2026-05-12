import express, { Request, Response } from "express";
import { getUser } from "packages/getUser";
import { userCanSeeChannel } from "server/express/channelAccessSnapshot";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Restricted-audio proxy.
 *
 * The browser cannot send `x-api-key` headers from an `<audio>` tag, so for restricted
 * channels CODA proxies the audio bytes through its own server. We:
 *   1. Authenticate the user via launchpad-issued JWT
 *   2. Re-validate that the user has access to `channelSlug` against the channel-access
 *      snapshot (same predicate as the metadata fan-out — defense in depth)
 *   3. Fetch the underlying file from talkybot using the EMSS_TOKEN api key, which
 *      bypasses talkybot's public-only filter on `/external/audiofiles/:uuid/file`
 *   4. Stream it back to the browser
 *
 * For PUBLIC audio the comm pane keeps loading directly from talkybot — no need to add
 * proxy hops to the common case.
 *
 * MUST be reachable only via the launchpad-authed nginx path so JWT validation is
 * enforced upstream as well as in the Express layer.
 */

const router = express.Router();

router.get("/:uuid", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  if (user instanceof Error) {
    res.status(401).json({ status: "error", message: "Unauthorized: authentication required" });
    return;
  }

  const uuid = req.params.uuid;
  if (
    typeof uuid !== "string" ||
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid)
  ) {
    res.status(400).json({ status: "error", message: "Invalid uuid" });
    return;
  }

  const channelSlug = (req.query.channelSlug as string | undefined)?.trim();
  if (!channelSlug) {
    res.status(400).json({ status: "error", message: "channelSlug query param is required" });
    return;
  }

  if (!userCanSeeChannel(user, channelSlug)) {
    ConsoleLogger.warn(
      `restricted/audio: user ${user.auid} denied access to channel "${channelSlug}" (uuid ${uuid})`
    );
    res.status(403).json({ status: "error", message: "Forbidden" });
    return;
  }

  const baseUrl = process.env.VITE_PUBLIC_TALKYBOT_URL;
  const apiKey = process.env.EMSS_TOKEN;
  if (!baseUrl || !apiKey) {
    ConsoleLogger.error(
      "restricted/audio: VITE_PUBLIC_TALKYBOT_URL or EMSS_TOKEN env var is not set"
    );
    res.status(500).json({ status: "error", message: "Server misconfiguration" });
    return;
  }

  const upstreamUrl = `${baseUrl}/api/v1/external/audiofiles/${encodeURIComponent(uuid)}/file`;
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { "x-api-key": apiKey },
    });
    if (!upstream.ok || !upstream.body) {
      ConsoleLogger.warn(
        `restricted/audio: upstream ${upstream.status} for uuid ${uuid} (channel ${channelSlug})`
      );
      res.status(upstream.status === 404 ? 404 : 502).end();
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "audio/aac";
    const contentLength = upstream.headers.get("content-length");
    res.setHeader("content-type", contentType);
    if (contentLength) res.setHeader("content-length", contentLength);

    // Stream the response body to the client
    const reader = upstream.body.getReader();
    res.on("close", () => {
      void reader.cancel().catch(() => {});
    });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(value);
    }
    res.end();
  } catch (err) {
    ConsoleLogger.error("restricted/audio: proxy error:", err);
    if (!res.headersSent) {
      res.status(502).json({ status: "error", message: "Upstream fetch failed" });
    } else {
      res.end();
    }
  }
});

export default router;
