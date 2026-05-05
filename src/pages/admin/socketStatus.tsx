import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import isEqual from "lodash/isEqual";
import uniq from "lodash/uniq";
import { getCurrentUser } from "packages/getCurrentUser";
import { fetchJsonWithAuth } from "packages/fetchFns";
import { FunctionComponent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { io, Socket } from "socket.io-client";
import { isSuperuser } from "utils/user";
import ConsoleLogger from "utils/logging/consoleLogger";
import adminCommon from "./adminCommon.module.css";
import styles from "./socketStatus.module.css";

dayjs.extend(relativeTime);

const SOCKET_PATH = "/api/v1/socketio";

interface SourceData {
  source: string;
  dates: DateData[];
  totalVisitors: number;
}

interface DateData {
  date: string;
  users: UserData[];
  totalConnections: number;
}

interface UserData {
  uupic: string | undefined;
  displayName: string;
  connections: VisitorData[];
}

const ServerSocketStatus: FunctionComponent = () => {
  const navigate = useNavigate();
  const [visitorsData, setVisitorsData] = useState<VisitorData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [serverVersion, setServerVersion] = useState<AppVersion | null>(null);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  // Check if a date is within the past 7 days (MTX/HLS playback window)
  const isWithinLiveVideoWindow = (dateString: string): boolean => {
    const date = dayjs(dateString);
    const today = dayjs();
    const daysDiff = today.diff(date, "day");
    return daysDiff >= 0 && daysDiff <= 7;
  };

  // Handle toggle of live video restriction for a session
  const handleToggleLiveVideo = async (targetSocketId: string, currentlyDisabled: boolean) => {
    try {
      await fetchJsonWithAuth("/api/v1/emss/liveVideoToggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetSocketId,
          disabled: !currentlyDisabled,
        }),
      });
    } catch (error) {
      ConsoleLogger.error("Error toggling live video restriction:", error);
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      const user = await getCurrentUser();
      if (!mounted) return;

      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }

      // Initialize socket connection
      const socketUrl = window.location.origin;
      const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, {
        transports: ["websocket"],
        upgrade: true,
        path: SOCKET_PATH,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        if (!mounted) return;
        setConnectionStatus("connected");
        socket.emit("joinInspector");
      });

      socket.on("version", (version: AppVersion) => {
        if (!mounted) return;
        setServerVersion(version);
      });

      socket.on("disconnect", () => {
        if (!mounted) return;
        setConnectionStatus("disconnected");
      });

      socket.on("connect_error", (error) => {
        if (!mounted) return;
        setConnectionStatus("failed");
        setConnectionError(error?.message ?? "Socket connection error");
      });

      socket.on("visitorInspectorUpdate", (update: VisitorInspectorUpdate) => {
        if (!mounted) return;
        setVisitorsData(update.visitorsData);
        setLastUpdatedAt(update.updatedAt);
      });
    })();

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.emit("leaveInspector");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [navigate]);

  // Transform flat visitor data into hierarchical structure: Source -> Date -> Users
  const organizedData = useMemo((): SourceData[] => {
    if (visitorsData.length === 0) return [];

    const sources = uniq(visitorsData.map((v) => v.source)).sort();

    return sources.map((source): SourceData => {
      const sourceVisitors = visitorsData.filter((v) => v.source === source);
      const dates = uniq(sourceVisitors.map((v) => v.dateViewing)).sort((a, b) =>
        b.localeCompare(a)
      );

      const dateData: DateData[] = dates.map((date): DateData => {
        const dateVisitors = sourceVisitors.filter((v) => v.dateViewing === date);

        // Group by user
        const userMap = new Map<string | undefined, UserData>();
        dateVisitors.forEach((visitor) => {
          const key = visitor.user?.uupic;
          if (!userMap.has(key)) {
            const displayName =
              visitor.user?.display_name ||
              (visitor.user?.surname && visitor.user?.givenname
                ? `${visitor.user.surname}, ${visitor.user.givenname}`
                : "Unknown User");
            userMap.set(key, {
              uupic: key,
              displayName,
              connections: [],
            });
          }
          userMap.get(key)!.connections.push(visitor);
        });

        // Sort users by name
        const users = Array.from(userMap.values()).sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        );

        return {
          date,
          users,
          totalConnections: dateVisitors.length,
        };
      });

      return {
        source,
        dates: dateData,
        totalVisitors: sourceVisitors.length,
      };
    });
  }, [visitorsData]);

  const totalVisitors = visitorsData.length;
  const totalSources = organizedData.length;
  const totalUniqueDates = uniq(visitorsData.map((v) => v.dateViewing)).length;

  const formatTimestamp = (value?: string | null) => {
    if (!value) return "None";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const timeAgo = dayjs(value).fromNow();
    return (
      <>
        {date.toLocaleString()}
        <span style={{ marginLeft: "8px", opacity: 0.6, fontSize: "0.9em" }}>({timeAgo})</span>
      </>
    );
  };

  const connectionClass =
    connectionStatus === "connected"
      ? adminCommon.statusConnected
      : connectionStatus === "connecting"
        ? adminCommon.statusConnecting
        : adminCommon.statusDisconnected;

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin" className={adminCommon.backLink}>
          ← Admin
        </Link>
        <h1 className={adminCommon.pageTitle}>Visitor Activity</h1>
        <p className={adminCommon.introText}>
          Real-time management of all connected visitors organized by source and viewing date.
        </p>

        {/* Connection Status Panel */}
        <div className={adminCommon.infoPanel} role="status" aria-live="polite">
          <div className={adminCommon.infoItem}>
            <span className={adminCommon.infoLabel}>Socket status:</span>
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

        {/* Summary Stats */}
        <div className={adminCommon.infoPanel}>
          <div className={styles.summaryStats}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{totalVisitors}</span>
              <span className={styles.statLabel}>Total Connections</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{totalSources}</span>
              <span className={styles.statLabel}>Sources</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{totalUniqueDates}</span>
              <span className={styles.statLabel}>Dates Being Viewed</span>
            </div>
          </div>
        </div>

        {/* Content */}
        {totalVisitors === 0 ? (
          <div className={adminCommon.emptyState}>No visitors currently connected.</div>
        ) : (
          organizedData.map((sourceData) => (
            <section
              key={sourceData.source}
              className={adminCommon.section}
              aria-labelledby={`source-${sourceData.source}`}
            >
              <h2 id={`source-${sourceData.source}`} className={adminCommon.sectionHeading}>
                <span className={adminCommon.sectionHeadingMuted}>Source:</span>{" "}
                {sourceData.source || "Unknown"}
                <span
                  className={adminCommon.badgeSuccess}
                  style={{ marginLeft: 12, fontSize: "0.9rem" }}
                >
                  {sourceData.totalVisitors} connection
                  {sourceData.totalVisitors !== 1 ? "s" : ""}
                </span>
              </h2>

              {sourceData.dates.map((dateData) => (
                <div key={`${sourceData.source}-${dateData.date}`} className={styles.dateSection}>
                  <div className={styles.dateHeader}>
                    <h3 className={styles.dateTitle}>
                      <span className={adminCommon.sectionHeadingMuted}>Viewing:</span>{" "}
                      {dateData.date}
                    </h3>
                    <span className={styles.dateBadge}>
                      {dateData.users.length} user{dateData.users.length !== 1 ? "s" : ""} •{" "}
                      {dateData.totalConnections} connection
                      {dateData.totalConnections !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <table className={styles.usersTable}>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>{isWithinLiveVideoWindow(dateData.date) && "Live Video"}</th>
                        <th>Restricted Access</th>
                        <th>IP Address</th>
                        <th>Connected</th>
                        <th>Version</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dateData.users.flatMap((userData) =>
                        userData.connections.map((conn) => {
                          const isVideoDisabled = !conn.liveVideoEnabled;
                          return (
                            <tr key={conn.socketId}>
                              <td>
                                <span className={styles.userName}>{userData.displayName}</span>
                              </td>
                              <td>
                                {isWithinLiveVideoWindow(dateData.date) && (
                                  <button
                                    className={`${styles.liveVideoToggle} ${isVideoDisabled ? styles.liveVideoDisabled : styles.liveVideoEnabled}`}
                                    onClick={() =>
                                      handleToggleLiveVideo(conn.socketId, isVideoDisabled)
                                    }
                                    title={
                                      isVideoDisabled
                                        ? "Click to enable live video for this session"
                                        : "Click to disable live video for this session"
                                    }
                                  >
                                    {isVideoDisabled ? "Disabled" : "Enabled"}
                                  </button>
                                )}
                              </td>
                              <td>
                                {conn.restrictedAccesses && conn.restrictedAccesses.length > 0 ? (
                                  <span
                                    title={conn.restrictedAccesses
                                      .map(
                                        (a) =>
                                          `${a.overrideType} override #${a.overrideId} via grant "${a.grantName}" (#${a.grantId})`
                                      )
                                      .join("\n")}
                                  >
                                    {conn.restrictedAccesses
                                      .map((a) => `${a.overrideType}: ${a.grantName}`)
                                      .join(", ")}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td>
                                <span title={`Socket ID: ${conn.socketId}`}>
                                  {conn.user?.ip_address || "N/A"}
                                </span>
                              </td>
                              <td>
                                <time
                                  dateTime={new Date(conn.connectedAt).toISOString()}
                                  title={dayjs(conn.connectedAt).format("YYYY-MM-DD HH:mm:ss")}
                                >
                                  {dayjs(conn.connectedAt).fromNow()}
                                </time>
                              </td>
                              <td>
                                {conn.appVersion ? (
                                  <span
                                    className={
                                      serverVersion && !isEqual(conn.appVersion, serverVersion)
                                        ? adminCommon.badgeError
                                        : undefined
                                    }
                                    title={
                                      serverVersion && !isEqual(conn.appVersion, serverVersion)
                                        ? `Outdated - Server version: ${serverVersion.version}/${serverVersion.gitCommit}`
                                        : undefined
                                    }
                                  >
                                    {`${conn.appVersion.version}/${conn.appVersion.gitCommit}`}
                                  </span>
                                ) : (
                                  "N/A"
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          ))
        )}
      </div>
    </main>
  );
};

export default ServerSocketStatus;
