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
    backfillEnabled: boolean;
  }>({
    count: 0,
    latestEpoch: null,
    yearCounts: [],
    backfillEnabled: false,
  });
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [backfillProgress, setBackfillProgress] = useState<string[]>([]);
  const [gapStatus, setGapStatus] = useState<{
    totalRecords: number;
    gapsDetected: number;
    knownGapsSkipped: number;
    earliestGapStart: string | null;
    gapThresholdHours: number;
  } | null>(null);
  const [gapStatusLoading, setGapStatusLoading] = useState(false);

  // SpaceTrack status state
  const [spacetrackStatus, setSpacetrackStatus] = useState<SpaceTrackTrackerData | null>(null);
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

      const handleSpacetrackInspectorUpdate = (payload: SpaceTrackTrackerDataUpdate) => {
        setSpacetrackStatus(payload?.status ?? null);
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

      socket.on("spacetrackInspectorUpdate", handleSpacetrackInspectorUpdate);

      return () => {
        socket.emit("leaveInspector");
        socket.off("spacetrackInspectorUpdate", handleSpacetrackInspectorUpdate);
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
    fetchGapStatus();
  }, []);

  useEffect(() => {
    if (progressTextareaRef.current) {
      progressTextareaRef.current.scrollTop = progressTextareaRef.current.scrollHeight;
    }
  }, [backfillProgress]);

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

  const fetchGapStatus = async () => {
    setGapStatusLoading(true);
    try {
      const response = await fetch("/api/v1/db/ephemeris/backfill/status");
      if (!response.ok) return;
      const data = await response.json();
      setGapStatus(data);
    } catch (e) {
      console.error("Error fetching gap status:", e);
    } finally {
      setGapStatusLoading(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    setBackfillProgress(["Initializing..."]);
    try {
      const response = await fetch("/api/v1/db/ephemeris/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        setBackfillResult(`Error: ${data.message}`);
        setBackfillProgress([]);
        return;
      }

      // Streaming ndjson response from the backfill endpoint
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
                    setBackfillProgress((prev) => [...prev, progressData.progress]);
                  }
                  if (progressData.complete) {
                    setBackfillResult(`${progressData.message}`);
                  }
                } catch {
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
        setBackfillResult(`${data.message}`);
        fetchStats();
      }
    } catch (e) {
      setBackfillResult(`Error: ${e}`);
      setBackfillProgress([]);
    } finally {
      setBackfilling(false);
    }
  };

  // Trigger manual Space-Track update via API
  const handleTriggerSpacetrackUpdate = async () => {
    if (isTriggering) return;
    setIsTriggering(true);
    try {
      const response = await fetch("/api/v1/db/ephemeris/spacetrack/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const data = await response.json();
        console.error("Error triggering Space-Track update:", data.message);
      }
      // Status update will come via socket
    } catch (e) {
      console.error("Error triggering Space-Track update:", e);
      setIsTriggering(false);
    }
  };

  // Helper functions for formatting
  /** For TLE/data epochs — always shown in UTC so they match Space-Track values. */
  const formatTimestamp = (value?: string | null) => {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const timeAgo = dayjs(value).fromNow();
    const utcString = date.toLocaleString(undefined, { timeZone: "UTC" }) + " UTC";
    return (
      <>
        {utcString}
        <span style={{ marginLeft: "8px", opacity: 0.6, fontSize: "0.9em" }}>({timeAgo})</span>
      </>
    );
  };

  /** For server event timestamps — shown in the browser's local timezone. */
  const formatLocalTimestamp = (value?: string | null) => {
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
    if (!spacetrackStatus?.nextOperationAt) return null;
    const nextTime = new Date(spacetrackStatus.nextOperationAt).getTime();
    const remaining = nextTime - currentTime;
    if (remaining <= 0) return "Imminent";
    return formatDuration(remaining);
  };

  const getSchedulerStatusBadge = () => {
    if (!spacetrackStatus) {
      return { label: "Unknown", className: adminCommon.badgeNeutral };
    }
    if (!spacetrackStatus.isActive) {
      return { label: "Stopped", className: adminCommon.badgeError };
    }
    // Check if an update is currently in progress (attempt started but not completed yet)
    if (
      spacetrackStatus.lastOperationStartedAt &&
      (!spacetrackStatus.lastOperationCompletedAt ||
        new Date(spacetrackStatus.lastOperationStartedAt) >
          new Date(spacetrackStatus.lastOperationCompletedAt))
    ) {
      return { label: "Fetching", className: adminCommon.badgeFetching };
    }
    // No updates have completed yet
    if (spacetrackStatus.lastOperationSuccess === null) {
      return { label: "Starting", className: adminCommon.badgeFetching };
    }
    if (spacetrackStatus.lastOperationSuccess) {
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
          These records contain Two-Line Element (TLE) data for the ISS. TLEs are pulled
          automatically every 6 hours from Space-Track (or mirrored from prod on non-prod instances)
          and are used for orbit calculations and position tracking.
        </p>

        {/* Space-Track Scheduler Status Section */}
        <section className={adminCommon.section} aria-labelledby="spacetrack-heading">
          <header className={adminCommon.detailsHeader}>
            <h2 id="spacetrack-heading" className={adminCommon.sectionHeading}>
              <span className={adminCommon.sectionHeadingMuted}>Space-Track TLE Scheduler:</span>{" "}
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
                {lastUpdatedAt ? formatLocalTimestamp(lastUpdatedAt) : "None"}
              </span>
            </div>
          </div>

          {!spacetrackStatus ? (
            <div className={adminCommon.emptyState}>
              Waiting for Space-Track scheduler status data...
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
                        {spacetrackStatus.isActive ? "Running" : "Stopped"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Interval</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatDuration(spacetrackStatus.intervalMs)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Scheduler Started</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatLocalTimestamp(spacetrackStatus.startedAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Next Update</dt>
                      <dd className={adminCommon.definitionValue}>
                        {spacetrackStatus.nextOperationAt ? (
                          <>
                            {getTimeUntilNextUpdate()}
                            <span className={adminCommon.timestampRelative}>
                              ({new Date(spacetrackStatus.nextOperationAt).toLocaleTimeString()})
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
                        {formatLocalTimestamp(spacetrackStatus.lastOperationStartedAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Completed</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatLocalTimestamp(spacetrackStatus.lastOperationCompletedAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Duration</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatDuration(spacetrackStatus.lastOperationDurationMs)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Result</dt>
                      <dd
                        className={
                          spacetrackStatus.lastOperationSuccess === null
                            ? adminCommon.definitionValue
                            : spacetrackStatus.lastOperationSuccess
                              ? adminCommon.statusConnected
                              : adminCommon.statusDisconnected
                        }
                      >
                        {spacetrackStatus.lastOperationSuccess === null
                          ? "N/A"
                          : spacetrackStatus.lastOperationSuccess
                            ? "Success"
                            : "Failed"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>TLE Epoch</dt>
                      <dd className={adminCommon.definitionValue}>
                        {spacetrackStatus.lastFetchedEpoch
                          ? formatTimestamp(spacetrackStatus.lastFetchedEpoch)
                          : "N/A"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Records Inserted</dt>
                      <dd className={adminCommon.definitionValue}>
                        {spacetrackStatus.lastRecordsInserted ?? "N/A"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Records Skipped</dt>
                      <dd className={adminCommon.definitionValue}>
                        {spacetrackStatus.lastRecordsSkipped ?? "N/A"}
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
                        {spacetrackStatus.totalOperations}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Successful</dt>
                      <dd className={adminCommon.definitionValue}>
                        {spacetrackStatus.successfulOperations}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Failed</dt>
                      <dd className={adminCommon.definitionValue}>
                        {spacetrackStatus.failedOperations}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Success Rate</dt>
                      <dd className={adminCommon.definitionValue}>
                        {spacetrackStatus.totalOperations > 0
                          ? `${((spacetrackStatus.successfulOperations / spacetrackStatus.totalOperations) * 100).toFixed(1)}%`
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
                          spacetrackStatus.lastErrorMessage
                            ? adminCommon.definitionValueError
                            : adminCommon.definitionValue
                        }
                      >
                        {spacetrackStatus.lastErrorMessage || "None"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Last Error At</dt>
                      <dd className={adminCommon.definitionValue}>
                        {formatLocalTimestamp(spacetrackStatus.lastErrorAt)}
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
                        {formatLocalTimestamp(spacetrackStatus.lastManualTriggerAt)}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Triggered By</dt>
                      <dd className={adminCommon.definitionValue}>
                        {spacetrackStatus.lastManualTriggerBy || "N/A"}
                      </dd>
                    </div>
                    <div className={adminCommon.definitionRow}>
                      <dt className={adminCommon.definitionTerm}>Action</dt>
                      <dd className={adminCommon.definitionValue}>
                        <button
                          type="button"
                          onClick={handleTriggerSpacetrackUpdate}
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
                      {stats.latestEpoch ? formatTimestamp(stats.latestEpoch) : "N/A"}
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

        {/* Backfill Section (prod-only) */}
        <section className={adminCommon.section} aria-labelledby="backfill-heading">
          <h2 id="backfill-heading" className={adminCommon.sectionHeading}>
            Backfill from Space-Track
          </h2>
          <div className={adminCommon.details}>
            {stats.backfillEnabled ? (
              <>
                {/* Gap scan status */}
                <div className={adminCommon.infoPanel} role="status" aria-live="polite">
                  <div className={adminCommon.infoItem}>
                    <span className={adminCommon.infoLabel}>TLE gap status:</span>
                    <span className={adminCommon.infoValue}>
                      {gapStatusLoading ? (
                        "Scanning..."
                      ) : !gapStatus ? (
                        "Unknown"
                      ) : gapStatus.gapsDetected === 0 ? (
                        <span className={adminCommon.badgeSuccess}>
                          <span
                            className={`${adminCommon.statusIndicator} ${adminCommon.badgeSuccess}`}
                            style={{ marginRight: 8 }}
                            aria-hidden="true"
                          />
                          No gaps detected — database is complete
                        </span>
                      ) : (
                        <span className={adminCommon.badgeError}>
                          <span
                            className={`${adminCommon.statusIndicator} ${adminCommon.badgeError}`}
                            style={{ marginRight: 8 }}
                            aria-hidden="true"
                          />
                          {gapStatus.gapsDetected} gap{gapStatus.gapsDetected !== 1 ? "s" : ""}{" "}
                          detected (earliest:{" "}
                          {gapStatus.earliestGapStart
                            ? new Date(gapStatus.earliestGapStart).toLocaleDateString()
                            : "N/A"}
                          )
                        </span>
                      )}
                    </span>
                  </div>
                  {gapStatus && (
                    <>
                      <div className={adminCommon.infoItem}>
                        <span className={adminCommon.infoLabel}>Records scanned:</span>
                        <span className={adminCommon.infoValue}>
                          {gapStatus.totalRecords.toLocaleString()}
                        </span>
                      </div>
                      <div className={adminCommon.infoItem}>
                        <span className={adminCommon.infoLabel}>Known Space-Track outages:</span>
                        <span className={adminCommon.infoValue}>
                          {gapStatus.knownGapsSkipped} (ignored)
                        </span>
                      </div>
                      <div className={adminCommon.infoItem}>
                        <span className={adminCommon.infoLabel}>Gap threshold:</span>
                        <span className={adminCommon.infoValue}>
                          {gapStatus.gapThresholdHours}h between consecutive TLEs
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <p className={adminCommon.descriptionText}>
                  {gapStatus?.gapsDetected === 0
                    ? "The database has no unexpected gaps. Running backfill will make zero " +
                      "Space-Track API calls. You can still click the button to verify."
                    : "Scan the local DB for gaps in TLE coverage and, if any are found, issue a " +
                      "single gp_history query to Space-Track to fill them in. Space-Track " +
                      'rate-limits this class to "1 / lifetime" per object, so this should be ' +
                      "used sparingly. Existing records are deduplicated by epoch."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleBackfill().then(() => fetchGapStatus());
                  }}
                  disabled={backfilling}
                  className={`${adminCommon.button} ${adminCommon.buttonPrimary}`}
                  aria-busy={backfilling}
                >
                  {backfilling
                    ? "Backfilling..."
                    : gapStatus?.gapsDetected === 0
                      ? "Verify (no gaps detected)"
                      : "Backfill Missing TLEs"}
                </button>
                {backfillProgress.length > 0 && (
                  <textarea
                    ref={progressTextareaRef}
                    readOnly
                    value={backfillProgress.join("\n")}
                    className={adminCommon.logTextarea}
                    aria-label="Backfill progress log"
                  />
                )}
                {backfillResult && <p className={adminCommon.resultMessage}>{backfillResult}</p>}
              </>
            ) : (
              <p className={adminCommon.descriptionText}>
                Backfill is disabled on this instance. This server mirrors TLE data from another
                CODA instance (<code>EPHEMERIS_SYNC_FROM_URL</code> is set), so there is nothing to
                backfill here — missing records will arrive automatically via the scheduler.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default AdminEphemeris;
