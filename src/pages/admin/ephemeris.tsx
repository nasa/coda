import { FunctionComponent, useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";
import styles from "./ephemeris.module.css";

dayjs.extend(relativeTime);
dayjs.extend(duration);

const SOCKET_PATH = "/api/v1/socketio";

const AdminEphemeris: FunctionComponent = () => {
  const navigate = useNavigate();
  const progressTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [stats, setStats] = useState<{
    count: number;
    latestEpoch: string | null;
    yearCounts: Array<{ year: number; count: number }>;
  }>({
    count: 0,
    latestEpoch: null,
    yearCounts: [],
  });
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seedProgress, setSeedProgress] = useState<string[]>([]);

  // Celestrak status state
  const [celestrakStatus, setCelestrakStatus] = useState<CelestrakTrackerData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [isTriggering, setIsTriggering] = useState(false);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

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
      socketRef.current = socket;

      const handleCelestrakInspectorUpdate = (payload: CelestrakTrackerDataUpdate) => {
        setCelestrakStatus(payload?.status ?? null);
        setLastUpdatedAt(payload?.updatedAt ?? null);
        setConnectionStatus("connected");
        setConnectionError(null);
        setIsTriggering(false);
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

      socket.on("celestrakInspectorUpdate", handleCelestrakInspectorUpdate);

      return () => {
        socket.emit("leaveInspector");
        socket.off("celestrakInspectorUpdate", handleCelestrakInspectorUpdate);
        socket.off("connect");
        socket.off("disconnect");
        socket.off("connect_error");
        socket.disconnect();
        socketRef.current = null;
      };
    })();
  }, [navigate]);

  // Update current time for duration calculations
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (progressTextareaRef.current) {
      progressTextareaRef.current.scrollTop = progressTextareaRef.current.scrollHeight;
    }
  }, [seedProgress]);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/v1/db/ephemeris/stats");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    setSeedProgress(["Initializing..."]);
    try {
      const response = await fetch("/api/v1/db/ephemeris/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        setSeedResult(`Error: ${data.message}`);
        setSeedProgress([]);
        return;
      }

      // Check if response is streaming (text/event-stream or ndjson)
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/event-stream") || contentType?.includes("ndjson")) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const progressData = JSON.parse(line);
                  if (progressData.progress) {
                    setSeedProgress((prev) => [...prev, progressData.progress]);
                  }
                  if (progressData.complete) {
                    setSeedResult(`${progressData.message}`);
                  }
                } catch (e) {
                  // Skip invalid JSON lines
                }
              }
            }
          }
        }
        fetchStats(); // Refresh stats
      } else {
        // Fallback to regular JSON response
        const data = await response.json();
        setSeedResult(`${data.message}`);
        fetchStats(); // Refresh stats
      }
    } catch (e) {
      setSeedResult(`Error: ${e}`);
      setSeedProgress([]);
    } finally {
      setSeeding(false);
    }
  };

  // Trigger manual Celestrak update via API
  const handleTriggerCelestrakUpdate = async () => {
    if (isTriggering) return;
    setIsTriggering(true);
    try {
      const response = await fetch("/api/v1/db/ephemeris/celestrak/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const data = await response.json();
        console.error("Error triggering Celestrak update:", data.message);
      }
      // Status update will come via socket
    } catch (e) {
      console.error("Error triggering Celestrak update:", e);
      setIsTriggering(false);
    }
  };

  // Helper functions for formatting
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

  const getTimeUntilNextUpdate = () => {
    if (!celestrakStatus?.nextOperationAt) return null;
    const nextTime = new Date(celestrakStatus.nextOperationAt).getTime();
    const remaining = nextTime - currentTime;
    if (remaining <= 0) return "Imminent";
    return formatDuration(remaining);
  };

  const getSchedulerStatusBadge = () => {
    if (!celestrakStatus) {
      return { label: "Unknown", className: adminCommon.badgeNeutral };
    }
    if (!celestrakStatus.isActive) {
      return { label: "Stopped", className: adminCommon.badgeError };
    }
    // Check if an update is currently in progress (attempt started but not completed yet)
    if (
      celestrakStatus.lastOperationStartedAt &&
      (!celestrakStatus.lastOperationCompletedAt ||
        new Date(celestrakStatus.lastOperationStartedAt) >
          new Date(celestrakStatus.lastOperationCompletedAt))
    ) {
      return { label: "Fetching", className: adminCommon.badgeFetching };
    }
    // No updates have completed yet
    if (celestrakStatus.lastOperationSuccess === null) {
      return { label: "Starting", className: adminCommon.badgeFetching };
    }
    if (celestrakStatus.lastOperationSuccess) {
      return { label: "Running", className: adminCommon.badgeSuccess };
    }
    return { label: "Error", className: adminCommon.badgeError };
  };

  const connectionClass =
    connectionStatus === "connected"
      ? adminCommon.statusConnected
      : connectionStatus === "connecting" || connectionStatus === "reconnecting"
        ? adminCommon.statusConnecting
        : adminCommon.statusDisconnected;

  const schedulerStatusBadge = getSchedulerStatusBadge();

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin" className={adminCommon.backLink}>
          ← Admin
        </Link>
        <h1 className={adminCommon.pageTitle}>Ephemeris (ISS TLE)</h1>
        <p className={adminCommon.introText}>
          These records contain Two-Line Element (TLE) data for the ISS. TLEs are automatically
          seeded from historical data and can be used for orbit calculations and position tracking.
        </p>

        {/* Celestrak Scheduler Status Section */}
        <section className={adminCommon.section} aria-labelledby="celestrak-heading">
          <header className={adminCommon.detailsHeader}>
            <h2 id="celestrak-heading" className={adminCommon.sectionHeading}>
              <span className={adminCommon.sectionHeadingMuted}>Celestrak TLE Scheduler:</span>{" "}
              <span className={schedulerStatusBadge.className} style={{ marginLeft: 8 }}>
                <span
                  className={`${adminCommon.statusIndicator} ${schedulerStatusBadge.className}`}
                  style={{ marginRight: 8 }}
                  aria-hidden="true"
                />
                {schedulerStatusBadge.label}
              </span>
            </h2>
          </header>

          {/* Page socket connection status */}
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

          {!celestrakStatus ? (
            <div className={adminCommon.emptyState}>
              Waiting for Celestrak scheduler status data...
            </div>
          ) : (
            <div className={adminCommon.details}>
              <div className={adminCommon.grid}>
                {/* Scheduler Info Section */}
                <div className={adminCommon.gridSection}>
                  <h3 className={adminCommon.gridSectionHeader}>Scheduler Details</h3>
                  <dl className={adminCommon.definitionList}>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Status</dt>
                      <dd className={adminCommon.definitionValue}>
                        {celestrakStatus.isActive ? "Running" : "Stopped"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Interval</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatDuration(celestrakStatus.intervalMs)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Scheduler Started</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatTimestamp(celestrakStatus.startedAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Next Update</dt>
                      <dd className={adminCommon.definitionValue}>
                        {celestrakStatus.nextOperationAt ? (
                          <>
                            {getTimeUntilNextUpdate()}
                            <span className={adminCommon.timestampRelative}>
                              ({new Date(celestrakStatus.nextOperationAt).toLocaleTimeString()})
                            </span>
                          </>
                        ) : (
                          "N/A"
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Last Update Section */}
                <div className={adminCommon.gridSection}>
                  <h3 className={adminCommon.gridSectionHeader}>Last Update</h3>
                  <dl className={adminCommon.definitionList}>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Attempt</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatTimestamp(celestrakStatus.lastOperationStartedAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Completed</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatTimestamp(celestrakStatus.lastOperationCompletedAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Duration</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatDuration(celestrakStatus.lastOperationDurationMs)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Result</dt>
                      <dd
                        className={
                          celestrakStatus.lastOperationSuccess === null
                            ? adminCommon.definitionValue
                            : celestrakStatus.lastOperationSuccess
                              ? adminCommon.statusConnected
                              : adminCommon.statusDisconnected
                        }
                      >
                        {celestrakStatus.lastOperationSuccess === null
                          ? "N/A"
                          : celestrakStatus.lastOperationSuccess
                            ? "Success"
                            : "Failed"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>TLE Epoch</dt>
                      <dd className={adminCommon.definitionValue}>
                        {celestrakStatus.lastFetchedEpoch
                          ? formatTimestamp(celestrakStatus.lastFetchedEpoch)
                          : "N/A"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Statistics Section */}
                <div className={adminCommon.gridSection}>
                  <h3 className={adminCommon.gridSectionHeader}>
                    Statistics (since server last restarted)
                  </h3>
                  <dl className={adminCommon.definitionList}>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Total Updates</dt>
                      <dd className={adminCommon.definitionValue}>
                        {celestrakStatus.totalOperations}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Successful</dt>
                      <dd className={adminCommon.definitionValue}>
                        {celestrakStatus.successfulOperations}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Failed</dt>
                      <dd className={adminCommon.definitionValue}>
                        {celestrakStatus.failedOperations}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Success Rate</dt>
                      <dd className={adminCommon.definitionValue}>
                        {celestrakStatus.totalOperations > 0
                          ? `${((celestrakStatus.successfulOperations / celestrakStatus.totalOperations) * 100).toFixed(1)}%`
                          : "N/A"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Errors Section */}
                <div className={adminCommon.gridSection}>
                  <h3 className={adminCommon.gridSectionHeader}>Errors</h3>
                  <dl className={adminCommon.definitionList}>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Error</dt>
                      <dd
                        className={
                          celestrakStatus.lastErrorMessage
                            ? adminCommon.definitionValueError
                            : adminCommon.definitionValue
                        }
                      >
                        {celestrakStatus.lastErrorMessage || "None"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Error At</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatTimestamp(celestrakStatus.lastErrorAt)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Manual Trigger Section */}
                <div className={adminCommon.gridSection}>
                  <h3 className={adminCommon.gridSectionHeader}>Manual Trigger</h3>
                  <dl className={adminCommon.definitionList}>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Manual Trigger</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatTimestamp(celestrakStatus.lastManualTriggerAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Triggered By</dt>
                      <dd className={adminCommon.definitionValue}>
                        {celestrakStatus.lastManualTriggerBy || "N/A"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Action</dt>
                      <dd className={adminCommon.definitionValue}>
                        <button
                          type="button"
                          onClick={handleTriggerCelestrakUpdate}
                          disabled={isTriggering || connectionStatus !== "connected"}
                          className={adminCommon.button}
                          aria-busy={isTriggering}
                        >
                          {isTriggering ? "Triggering..." : "Trigger Update Now"}
                        </button>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Database Statistics Section */}
        <section className={adminCommon.section} aria-labelledby="db-stats-heading">
          <h2 id="db-stats-heading" className={adminCommon.sectionHeading}>
            Database Statistics
          </h2>
          <div className={adminCommon.details}>
            <div className={adminCommon.grid}>
              <div className={adminCommon.gridSection}>
                <dl className={adminCommon.definitionList}>
                  <div className={adminCommon.definitionRow}>
                    <dt className={adminCommon.definitionTerm}>Total Records</dt>
                    <dd className={adminCommon.definitionValue}>{stats.count.toLocaleString()}</dd>
                  </div>
                  <div className={adminCommon.definitionRow}>
                    <dt className={adminCommon.definitionTerm}>Latest Epoch</dt>
                    <dd className={adminCommon.definitionValue}>
                      {stats.latestEpoch ? new Date(stats.latestEpoch).toISOString() : "N/A"}
                    </dd>
                  </div>
                </dl>
              </div>
              {stats.yearCounts?.length > 0 && (
                <div className={adminCommon.gridSection}>
                  <h3 className={adminCommon.gridSectionHeader}>Records by Year</h3>
                  <div
                    className={styles.yearCountsGrid}
                    style={{
                      gridTemplateRows: `repeat(${Math.ceil(stats.yearCounts.length / 3)}, auto)`,
                      gridTemplateColumns: "repeat(3, 1fr)",
                    }}
                  >
                    {stats.yearCounts.map((yc) => (
                      <div key={yc.year} className={styles.yearCountItem}>
                        <span className={styles.yearCountLabel}>{yc.year}:</span>
                        <span className={styles.yearCountValue}>{yc.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Seed Database Section */}
        <section className={adminCommon.section} aria-labelledby="seed-heading">
          <h2 id="seed-heading" className={adminCommon.sectionHeading}>
            Seed Database
          </h2>
          <div className={adminCommon.details}>
            <p className={adminCommon.descriptionText}>
              Seed missing historical TLE data from ISS in Real time (data.issinrealtime.org)
            </p>
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className={`${adminCommon.button} ${adminCommon.buttonPrimary}`}
              aria-busy={seeding}
            >
              {seeding ? "Seeding..." : "Seed Missing Data"}
            </button>
            {seedProgress.length > 0 && (
              <textarea
                ref={progressTextareaRef}
                readOnly
                value={seedProgress.join("\n")}
                className={adminCommon.logTextarea}
                aria-label="Seeding progress log"
              />
            )}
            {seedResult && <p className={adminCommon.resultMessage}>{seedResult}</p>}
          </div>
        </section>
      </div>
    </main>
  );
};

export default AdminEphemeris;
