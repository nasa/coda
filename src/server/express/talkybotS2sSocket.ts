import "utils/loadEnv";
import { io, Socket } from "socket.io-client";
import { ConsoleLogger } from "../../utils/logging/consoleLogger";
import { emitIncrementalDataUpdate, emitTalkybotS2sSocketInspectorUpdate } from "./sockets";
import { toTbAudioFileConverted } from "../processing/talkybot";
import { getSourcesWithDataType, getSourcesForTalkybotGroup } from "../../utils/sourceDataTypeMap";

/**
 * TalkybotS2s Server-to-Server Socket.IO client connection to Talkybot
 *
 * This module establishes and maintains a persistent socket connection
 * to the Talkybot server for receiving real-time data updates.
 * This is a one-way connection - Coda only receives events from Talkybot.
 */

// Events that Talkybot server sends to this client
interface TalkybotS2sServerToClientEvents {
  statusFromServer: (payload: TalkybotS2sStatusFromServer) => void;
  version: (appVersion: string) => void;
  /** Real-time push for a newly-recorded *public* audio file. */
  audioFile: (payload: TbAudioFileNative) => void;
  /**
   * Real-time push for a newly-recorded *non-public/restricted* audio file. Talkybot
   * separates this from `audioFile` so old CODA clients (which only listen for
   * `audioFile`) can't accidentally leak restricted audio. CODA handles both events
   * identically and relies on (group, sim) routing for source assignment.
   */
  restrictedAudioFile: (payload: TbAudioFileNative) => void;
}

interface TalkybotS2sStatusFromServer {
  timestamp: number;
  version: string;
}

type TalkybotS2sSocket = Socket<TalkybotS2sServerToClientEvents, never>;

// Module-level socket instance
let talkybotS2sSocket: TalkybotS2sSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = process.env.NODE_ENV === "production" ? Infinity : 10;

// TalkybotS2sSocket status tracking for admin monitoring
let talkybotS2sSocketTrackerData: TalkybotS2sSocketTrackerData = {
  isConnected: false,
  connectionStatus: "disconnected",
  connectedAt: null,
  disconnectedAt: null,
  targetUrl: null,
  socketPath: "/api/v1/s2sSocketio/",
  socketId: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
  lastReconnectAttemptAt: null,
  lastErrorMessage: null,
  lastErrorAt: null,
  messagesReceived: 0,
  lastMessageReceivedAt: null,
  lastMessageType: null,
  lastMessagePreview: null,
  talkybotVersion: null,
  lastStatusFromTalkybot: null,
  audioFilesReceived: 0,
  lastAudioFileReceivedAt: null,
  lastAudioFileUuid: null,
  lastAudioFilePreview: null,
};

/**
 * Update the TalkybotS2sSocket tracker data and emit to inspector clients
 */
const updateTalkybotS2sSocketTrackerData = (
  updates: Partial<TalkybotS2sSocketTrackerData>
): void => {
  talkybotS2sSocketTrackerData = { ...talkybotS2sSocketTrackerData, ...updates };
  emitTalkybotS2sSocketInspectorUpdate();
};

/**
 * Get the current TalkybotS2sSocket tracker data for admin monitoring
 */
export const getTalkybotS2sSocketTrackerData = (): TalkybotS2sSocketTrackerData => {
  return { ...talkybotS2sSocketTrackerData };
};

/**
 * Initialize the TalkybotS2s server-to-server socket connection to Talkybot
 */
export const initTalkybotS2sSocket = (): TalkybotS2sSocket | null => {
  const baseUrl = process.env.VITE_PUBLIC_TALKYBOT_URL;
  const authToken = process.env.EMSS_TOKEN;

  if (!baseUrl) {
    ConsoleLogger.error(
      "TalkybotS2s Socket: VITE_PUBLIC_TALKYBOT_URL environment variable is not set"
    );
    updateTalkybotS2sSocketTrackerData({
      connectionStatus: "failed",
      lastErrorMessage: "VITE_PUBLIC_TALKYBOT_URL environment variable is not set",
      lastErrorAt: new Date().toISOString(),
    });
    return null;
  }

  if (!authToken) {
    ConsoleLogger.error("TalkybotS2s Socket: EMSS_TOKEN environment variable is not set");
    updateTalkybotS2sSocketTrackerData({
      connectionStatus: "failed",
      lastErrorMessage: "EMSS_TOKEN environment variable is not set",
      lastErrorAt: new Date().toISOString(),
    });
    return null;
  }

  // Reuse existing socket instance if it exists (trusts automatic reconnection)
  if (talkybotS2sSocket) {
    ConsoleLogger.debug("TalkybotS2s Socket: Reusing existing socket instance");
    return talkybotS2sSocket;
  }

  // Update status to connecting
  updateTalkybotS2sSocketTrackerData({
    connectionStatus: "connecting",
    targetUrl: baseUrl,
    socketPath: "/api/v1/s2sSocketio/",
  });

  // Allow self-signed certificates in non-production environments
  const isProduction = process.env.NODE_ENV === "production";

  talkybotS2sSocket = io(baseUrl, {
    path: "/api/v1/s2sSocketio/",
    auth: {
      token: authToken,
    },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 20000,
    // Allow self-signed certificates in non-production environments
    rejectUnauthorized: isProduction,
  });

  ConsoleLogger.info(`TalkybotS2s Socket: Connecting to ${baseUrl} (path: /api/v1/s2sSocketio/)`);

  // Connection event handlers
  talkybotS2sSocket.on("connect", () => {
    reconnectAttempts = 0;
    const now = new Date().toISOString();
    ConsoleLogger.info(
      `TalkybotS2s Socket: Connected to Talkybot (socket id: ${talkybotS2sSocket?.id})`
    );
    updateTalkybotS2sSocketTrackerData({
      isConnected: true,
      connectionStatus: "connected",
      connectedAt: now,
      disconnectedAt: null,
      socketId: talkybotS2sSocket?.id ?? null,
      reconnectAttempts: 0,
      lastErrorMessage: null,
    });
  });

  talkybotS2sSocket.on("disconnect", (reason) => {
    ConsoleLogger.info(`TalkybotS2s Socket: Disconnected from Talkybot - ${reason}`);
    updateTalkybotS2sSocketTrackerData({
      isConnected: false,
      connectionStatus: "disconnected",
      disconnectedAt: new Date().toISOString(),
      socketId: null,
    });
  });

  talkybotS2sSocket.on("connect_error", (error) => {
    reconnectAttempts++;
    ConsoleLogger.error(
      `TalkybotS2s Socket: Connection error (attempt ${reconnectAttempts}):`,
      error.message
    );

    // Log additional error details for debugging
    if (error.message === "Server configuration error") {
      ConsoleLogger.error(
        "TalkybotS2s Socket: This usually means the Talkybot server's EMSS_TOKEN is not set or there's a server-side configuration issue"
      );
    } else if (error.message.includes("Authentication failed")) {
      ConsoleLogger.error(
        `TalkybotS2s Socket: Token mismatch - verify EMSS_TOKEN matches on both sides. Using token: ${authToken?.substring(0, 8)}... (partial)`
      );
    }

    const isFailed = reconnectAttempts >= MAX_RECONNECT_ATTEMPTS;
    if (isFailed) {
      ConsoleLogger.error("TalkybotS2s Socket: Max reconnection attempts reached");
    }

    updateTalkybotS2sSocketTrackerData({
      isConnected: false,
      connectionStatus: isFailed ? "failed" : "reconnecting",
      reconnectAttempts,
      lastErrorMessage: error.message,
      lastErrorAt: new Date().toISOString(),
    });
  });

  talkybotS2sSocket.io.on("reconnect", (attemptNumber) => {
    ConsoleLogger.notice(`TalkybotS2s Socket: Reconnected after ${attemptNumber} attempts`);
    reconnectAttempts = 0;
    updateTalkybotS2sSocketTrackerData({
      isConnected: true,
      connectionStatus: "connected",
      connectedAt: new Date().toISOString(),
      disconnectedAt: null,
      socketId: talkybotS2sSocket?.id ?? null,
      reconnectAttempts: 0,
    });
  });

  talkybotS2sSocket.io.on("reconnect_attempt", (attemptNumber) => {
    ConsoleLogger.warn(`TalkybotS2s Socket: Reconnection attempt ${attemptNumber}`);
    updateTalkybotS2sSocketTrackerData({
      connectionStatus: "reconnecting",
      reconnectAttempts: attemptNumber,
      lastReconnectAttemptAt: new Date().toISOString(),
    });
  });

  talkybotS2sSocket.io.on("reconnect_failed", () => {
    ConsoleLogger.error("TalkybotS2s Socket: Reconnection failed after all attempts");
    updateTalkybotS2sSocketTrackerData({
      connectionStatus: "failed",
      lastErrorMessage: "Reconnection failed after all attempts",
      lastErrorAt: new Date().toISOString(),
    });
  });

  // Event handlers for incoming Talkybot events
  talkybotS2sSocket.on("version", (appVersion) => {
    ConsoleLogger.debug(`TalkybotS2s Socket: Talkybot version: ${appVersion}`);
    updateTalkybotS2sSocketTrackerData({
      messagesReceived: talkybotS2sSocketTrackerData.messagesReceived + 1,
      lastMessageReceivedAt: new Date().toISOString(),
      lastMessageType: "version",
      lastMessagePreview: appVersion,
      talkybotVersion: appVersion,
    });
  });

  talkybotS2sSocket.on("statusFromServer", (payload) => {
    updateTalkybotS2sSocketTrackerData({
      messagesReceived: talkybotS2sSocketTrackerData.messagesReceived + 1,
      lastMessageReceivedAt: new Date().toISOString(),
      lastMessageType: "statusFromServer",
      lastMessagePreview: `v${payload.version} @ ${new Date(payload.timestamp).toISOString()}`,
      lastStatusFromTalkybot: payload,
    });
  });

  // Talkybot emits two real-time events: `audioFile` for public channels and
  // `restrictedAudioFile` for non-public ones (kept separate so old CODA clients
  // can't accidentally leak restricted audio by listening on `audioFile`). CODA
  // handles both identically - source routing is decided downstream by
  // (group, sim) via getSourcesForTalkybotGroup.
  const handleIncomingAudioFile = (
    eventType: "audioFile" | "restrictedAudioFile",
    payload: TbAudioFileNative
  ): void => {
    const audioFile = toTbAudioFileConverted(payload);

    ConsoleLogger.debug(`TalkybotS2s Socket: Received ${eventType} - ${audioFile.fileUuid}`);

    const textPreview = audioFile.text
      ? `"${audioFile.text.substring(0, 80)}${audioFile.text.length > 80 ? "..." : ""}"`
      : "No transcript";

    updateTalkybotS2sSocketTrackerData({
      messagesReceived: talkybotS2sSocketTrackerData.messagesReceived + 1,
      lastMessageReceivedAt: new Date().toISOString(),
      lastMessageType: eventType,
      lastMessagePreview: `${audioFile.channel}: ${textPreview}`,
      audioFilesReceived: talkybotS2sSocketTrackerData.audioFilesReceived + 1,
      lastAudioFileReceivedAt: new Date().toISOString(),
      lastAudioFileUuid: audioFile.fileUuid,
      lastAudioFilePreview: `[${audioFile.channel}] ${textPreview} (${audioFile.duration}s)`,
    });

    // Emit incremental update to clients viewing today's date.
    const today = new Date().toISOString().split("T")[0];

    // Use (group, sim) to target the correct source(s); a single talkybot group can
    // map to multiple CODA sources (e.g. the miscellaneous non-ISS bucket), or to
    // zero sources (e.g. Sim-ISS, which is intentionally dropped). If the file has
    // no group info at all, fall back to sending to every talkybot-enabled source
    // so we don't silently drop it.
    const allTalkybotSources = getSourcesWithDataType("talkybot");
    let targetSources: Source[];

    if (audioFile.groups.length > 0) {
      const mappedSources = new Set<Source>();
      for (const group of audioFile.groups) {
        for (const source of getSourcesForTalkybotGroup(group.slug, audioFile.sim)) {
          mappedSources.add(source);
        }
      }
      targetSources = [...mappedSources];
    } else {
      targetSources = allTalkybotSources;
    }

    for (const source of targetSources) {
      emitIncrementalDataUpdate({
        source,
        dataDate: today,
        incrementalUpdate: {
          type: "talkybot",
          item: audioFile,
        },
      });
    }
  };

  talkybotS2sSocket.on("audioFile", (payload) => handleIncomingAudioFile("audioFile", payload));
  talkybotS2sSocket.on("restrictedAudioFile", (payload) =>
    handleIncomingAudioFile("restrictedAudioFile", payload)
  );

  return talkybotS2sSocket;
};

/**
 * Disconnect the TalkybotS2s socket connection
 */
export const disconnectTalkybotS2sSocket = (): void => {
  if (talkybotS2sSocket) {
    ConsoleLogger.info("TalkybotS2s Socket: Disconnecting...");
    talkybotS2sSocket.removeAllListeners();
    talkybotS2sSocket.disconnect();
    talkybotS2sSocket = null;
    reconnectAttempts = 0;
    updateTalkybotS2sSocketTrackerData({
      isConnected: false,
      connectionStatus: "disconnected",
      disconnectedAt: new Date().toISOString(),
      socketId: null,
    });
    ConsoleLogger.info("TalkybotS2s Socket: Disconnected");
  }
};
