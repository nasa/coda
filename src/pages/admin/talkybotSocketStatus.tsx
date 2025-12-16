import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

dayjs.extend(relativeTime);
dayjs.extend(duration);

const SOCKET_PATH = "/api/v1/socketio";
const UPDATE_INTERVAL_MS = 1000;

const TalkybotSocketStatus: FunctionComponent = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<TalkybotS2sSocketTrackerData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Authorization check and socket connection
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }

      setConnectionStatus("connecting");
      setConnectionError(null);

      const socketUrl = window.location.origin;
      const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, {
        transports: ["websocket"],
        upgrade: true,
        path: SOCKET_PATH,
      });

      const handleTalkybotS2sSocketInspectorUpdate = (
        payload: TalkybotS2sSocketTrackerDataUpdate
      ) => {
        setStatus(payload?.status ?? null);
        setLastUpdatedAt(payload?.updatedAt ?? null);
        setConnectionStatus("connected");
        setConnectionError(null);
      };

      socket.on("connect", () => {
        setConnectionStatus("connected");
        socket.emit("joinInspector");
      });

      socket.on("disconnect", () => {
        setConnectionStatus("disconnected");
      });

      socket.on("connect_error", (error) => {
        setConnectionStatus("failed");
        setConnectionError(error?.message ?? "Socket connection error");
      });

      socket.on("talkybotS2sSocketInspectorUpdate", handleTalkybotS2sSocketInspectorUpdate);

      return () => {
        socket.emit("leaveInspector");
        socket.off("talkybotS2sSocketInspectorUpdate", handleTalkybotS2sSocketInspectorUpdate);
        socket.off("connect");
        socket.off("disconnect");
        socket.off("connect_error");
        socket.disconnect();
      };
    })();
  }, [navigate]);

  // Update current time for duration calculations
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const formatTimestamp = (value?: string | null) => {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const timeAgo = dayjs(value).fromNow();
    return (
      <>
        {date.toLocaleString()}
        <span style={{ marginLeft: "8px", opacity: 0.6, fontSize: "0.9em" }}>({timeAgo})</span>
      </>
    );
  };

  const formatDuration = (ms?: number | null) => {
    if (ms === undefined || ms === null) return "N/A";
    const d = dayjs.duration(ms);
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${d.seconds()}s`;
    if (ms < 3600000) return `${d.minutes()}m ${d.seconds()}s`;
    return `${Math.floor(d.asHours())}h ${d.minutes()}m ${d.seconds()}s`;
  };

  const getConnectionDuration = () => {
    if (!status?.connectedAt || !status?.isConnected) return null;
    const connectedTime = new Date(status.connectedAt).getTime();
    return currentTime - connectedTime;
  };

  const getTalkybotS2sConnectionClass = () => {
    if (!status) return adminCommon.statusDisconnected;
    switch (status.connectionStatus) {
      case "connected":
        return adminCommon.statusConnected;
      case "connecting":
      case "reconnecting":
        return adminCommon.statusConnecting;
      default:
        return adminCommon.statusDisconnected;
    }
  };

  const getTalkybotS2sStatusBadge = () => {
    if (!status) {
      return { label: "Unknown", className: adminCommon.badgeNeutral };
    }
    switch (status.connectionStatus) {
      case "connected":
        return { label: "Connected", className: adminCommon.badgeSuccess };
      case "connecting":
        return { label: "Connecting", className: adminCommon.badgeFetching };
      case "reconnecting":
        return { label: "Reconnecting", className: adminCommon.badgeFetching };
      case "disconnected":
        return { label: "Disconnected", className: adminCommon.badgeError };
      case "failed":
        return { label: "Failed", className: adminCommon.badgeError };
      default:
        return { label: "Unknown", className: adminCommon.badgeNeutral };
    }
  };

  const connectionClass =
    connectionStatus === "connected"
      ? adminCommon.statusConnected
      : connectionStatus === "connecting" || connectionStatus === "reconnecting"
        ? adminCommon.statusConnecting
        : adminCommon.statusDisconnected;

  const talkybotS2sStatusBadge = getTalkybotS2sStatusBadge();
  const connectionDuration = getConnectionDuration();

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin" className={adminCommon.backLink}>
          ← Admin
        </Link>
        <h1 className={adminCommon.pageTitle}>Talkybot S2s Connection Monitor</h1>
        <p className={adminCommon.introText}>
          Real-time monitoring of the server-to-server socket connection to Talkybot.
        </p>

        {/* Coda Socket Connection Status */}
        <div className={adminCommon.infoPanel} role="status" aria-live="polite">
          <div className={adminCommon.infoItem}>
            <span className={adminCommon.infoLabel}>Page socket status:</span>
            <span className={`${adminCommon.infoValue} ${connectionClass}`}>
              {connectionStatus}
            </span>
            {connectionError ? (
              <span className={adminCommon.statusErrorMessage}>({connectionError})</span>
            ) : null}
          </div>
          <div className={adminCommon.infoItem}>
            <span className={adminCommon.infoLabel}>Last update:</span>
            <span className={adminCommon.infoValue}>
              {lastUpdatedAt ? formatTimestamp(lastUpdatedAt) : "None"}
            </span>
          </div>
        </div>

        {/* TalkybotS2s Connection Status */}
        <section className={adminCommon.section} aria-labelledby="talkybotS2s-heading">
          <header className={adminCommon.detailsHeader}>
            <h2 id="talkybotS2s-heading" className={adminCommon.sectionHeading}>
              <span className={adminCommon.sectionHeadingMuted}>Talkybot Connection:</span>{" "}
              <span className={talkybotS2sStatusBadge.className} style={{ marginLeft: 8 }}>
                <span
                  className={`${adminCommon.statusIndicator} ${talkybotS2sStatusBadge.className}`}
                  style={{ marginRight: 8 }}
                  aria-hidden="true"
                />
                {talkybotS2sStatusBadge.label}
              </span>
            </h2>
          </header>

          {!status ? (
            <div className={adminCommon.emptyState}>
              Waiting for TalkybotS2s socket status data...
            </div>
          ) : (
            <div className={adminCommon.details}>
              <div className={adminCommon.grid}>
                {/* Connection Info Section */}
                <div className={adminCommon.gridSection}>
                  <h3 className={adminCommon.gridSectionHeader}>Connection Details</h3>
                  <dl className={adminCommon.definitionList}>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Status</dt>
                      <dd
                        className={`${adminCommon.definitionValue} ${getTalkybotS2sConnectionClass()}`}
                      >
                        {status.connectionStatus}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Target URL</dt>
                      <dd className={adminCommon.definitionValue}>
                        {status.targetUrl || "Not configured"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Socket Path</dt>
                      <dd className={adminCommon.definitionValue}>{status.socketPath}</dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Socket ID</dt>
                      <dd className={adminCommon.definitionValue}>{status.socketId || "N/A"}</dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Connected At</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatTimestamp(status.connectedAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Connection Uptime</dt>
                      <dd className={adminCommon.definitionValue}>
                        {status.isConnected ? formatDuration(connectionDuration) : "Not connected"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Disconnected At</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatTimestamp(status.disconnectedAt)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Reconnection & Errors Section */}
                <div className={adminCommon.gridSection}>
                  <h3 className={adminCommon.gridSectionHeader}>Reconnection & Errors</h3>
                  <dl className={adminCommon.definitionList}>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Reconnect Attempts</dt>
                      <dd className={adminCommon.definitionValue}>
                        {status.reconnectAttempts} / {status.maxReconnectAttempts}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Reconnect Attempt</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatTimestamp(status.lastReconnectAttemptAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Error</dt>
                      <dd
                        className={
                          status.lastErrorMessage
                            ? adminCommon.definitionValueError
                            : adminCommon.definitionValue
                        }
                      >
                        {status.lastErrorMessage || "None"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Error At</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatTimestamp(status.lastErrorAt)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Message Statistics Section */}
                <div className={adminCommon.gridSection}>
                  <h3 className={adminCommon.gridSectionHeader}>Message Statistics</h3>
                  <dl className={adminCommon.definitionList}>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Messages Received</dt>
                      <dd className={adminCommon.definitionValue}>{status.messagesReceived}</dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Message At</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatTimestamp(status.lastMessageReceivedAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Message Type</dt>
                      <dd className={adminCommon.definitionValue}>
                        {status.lastMessageType || "None"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Message Preview</dt>
                      <dd className={adminCommon.definitionValue}>
                        {status.lastMessagePreview || "No messages yet"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Talkybot Server Info Section */}
                <div className={adminCommon.gridSection}>
                  <h3 className={adminCommon.gridSectionHeader}>Talkybot Server Info</h3>
                  <dl className={adminCommon.definitionList}>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Talkybot Version</dt>
                      <dd className={adminCommon.definitionValue}>
                        {status.talkybotVersion || "Unknown"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Status Timestamp</dt>
                      <dd className={adminCommon.definitionValue}>
                        {status.lastStatusFromTalkybot
                          ? new Date(status.lastStatusFromTalkybot.timestamp).toLocaleString()
                          : "N/A"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Audio File Statistics Section */}
                <div className={adminCommon.gridSection}>
                  <h3 className={adminCommon.gridSectionHeader}>Audio File Events</h3>
                  <dl className={adminCommon.definitionList}>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Audio Files Received</dt>
                      <dd className={adminCommon.definitionValue}>{status.audioFilesReceived}</dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Audio File At</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatTimestamp(status.lastAudioFileReceivedAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Audio File UUID</dt>
                      <dd className={adminCommon.definitionValue}>
                        {status.lastAudioFileUuid || "None"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Audio File Preview</dt>
                      <dd className={adminCommon.definitionValue}>
                        {status.lastAudioFilePreview || "No audio files yet"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default TalkybotSocketStatus;
