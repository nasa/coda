import isEqual from "lodash/isEqual";
import { FunctionComponent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import { isDataTypeValidForSource } from "utils/sourceDataTypeMap";
import styles from "./fetchInspector.module.css";

dayjs.extend(relativeTime);

const SOCKET_PATH = "/api/v1/socketio";
const HIGHLIGHT_DURATION_MS = 10000;
const KEY_SEPARATOR = "::";
const COUNTDOWN_UPDATE_INTERVAL_MS = 1000;

const getDateKey = (source: string, date: string) => `${source}${KEY_SEPARATOR}${date}`;
const getStatusKey = (source: string, date: string, dataType: string) =>
  `${source}${KEY_SEPARATOR}${date}${KEY_SEPARATOR}${dataType}`;

const deriveStatusBadge = (
  status?: FetchTrackerDataSanitized
): { label: string; className: string } | null => {
  if (!status) {
    return {
      label: "N/A",
      className: styles.dataTypeBadgeNeutral,
    };
  }

  if (status.isFetching) {
    return {
      label: "Fetching",
      className: styles.dataTypeBadgeFetching,
    };
  }

  if (status.lastResultWasSuccess === false) {
    return {
      label: "Error",
      className: styles.dataTypeBadgeError,
    };
  }

  if (status.lastResultWasSuccess) {
    return {
      label: "Success",
      className: styles.dataTypeBadgeSuccess,
    };
  }

  return {
    label: "Ready",
    className: styles.dataTypeBadgeNeutral,
  };
};

const AdminFetchStatuses: FunctionComponent = () => {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [statuses, setStatuses] = useState<FetchTrackersSanitized>({});
  const [selectedTypes, setSelectedTypes] = useState<Record<string, string | null>>({});
  const [recentlyUpdated, setRecentlyUpdated] = useState<Record<string, number>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const previousStatusesRef = useRef<FetchTrackersSanitized>({});
  const updateTimeoutsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      setIsAuthorized(true);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!isAuthorized) return;

    setConnectionStatus("connecting");
    setConnectionError(null);
    previousStatusesRef.current = {};

    const socketUrl = window.location.origin;
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, {
      transports: ["websocket"],
      upgrade: true,
      path: SOCKET_PATH,
    });

    const handleFetchInspectorUpdate = (payload: FetchInspectorUpdate) => {
      const nextStatuses = payload?.fetchTrackersSanitized ?? {};
      const previous = previousStatusesRef.current ?? {};
      const updatedEntries: string[] = [];

      Object.entries(nextStatuses).forEach(([source, dateMap]) => {
        Object.entries(dateMap ?? {}).forEach(([date, typeMap]) => {
          Object.entries(typeMap ?? {}).forEach(([dataType, status]) => {
            const key = getStatusKey(source, date, dataType);
            const previousStatus = previous?.[source]?.[date]?.[dataType];
            if (!previousStatus || !isEqual(previousStatus, status)) {
              updatedEntries.push(key);
            }
          });
        });
      });

      previousStatusesRef.current = nextStatuses;
      setStatuses(nextStatuses);
      setLastUpdatedAt(payload?.updatedAt ?? null);
      setConnectionStatus("connected");
      setConnectionError(null);

      if (updatedEntries.length > 0) {
        setRecentlyUpdated((prev) => {
          const next = { ...prev };
          updatedEntries.forEach((key) => {
            // Clear any existing timeout for this key
            if (updateTimeoutsRef.current[key]) {
              window.clearTimeout(updateTimeoutsRef.current[key]);
            }

            // Set the update marker
            next[key] = Date.now();

            // Create new timeout to remove the marker
            updateTimeoutsRef.current[key] = window.setTimeout(() => {
              setRecentlyUpdated((current) => {
                const { [key]: _, ...rest } = current;
                return rest;
              });
              delete updateTimeoutsRef.current[key];
            }, HIGHLIGHT_DURATION_MS);
          });
          return next;
        });
      }
    };

    socket.on("connect", () => {
      setConnectionStatus("connected");
      socket.emit("joinFetchInspector");
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    socket.on("connect_error", (error) => {
      setConnectionStatus("failed");
      setConnectionError(error?.message ?? "Socket connection error");
    });

    socket.on("fetchInspectorUpdate", handleFetchInspectorUpdate);

    return () => {
      socket.emit("leaveFetchInspector");
      socket.off("fetchInspectorUpdate", handleFetchInspectorUpdate);
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.disconnect();
      previousStatusesRef.current = {};

      // Clear all pending timeouts
      Object.values(updateTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      updateTimeoutsRef.current = {};
    };
  }, [isAuthorized]);

  useEffect(() => {
    const validDateKeys = new Set<string>();
    const validStatusKeys = new Set<string>();

    Object.entries(statuses).forEach(([source, dateMap]) => {
      Object.entries(dateMap ?? {}).forEach(([date, typeMap]) => {
        const dateKey = getDateKey(source, date);
        validDateKeys.add(dateKey);
        Object.keys(typeMap ?? {}).forEach((dataType) => {
          validStatusKeys.add(getStatusKey(source, date, dataType));
        });
      });
    });

    setSelectedTypes((prev) => {
      const next = { ...prev };
      let changed = false;

      Object.entries(statuses).forEach(([source, dateMap]) => {
        Object.entries(dateMap ?? {}).forEach(([date, typeMap]) => {
          const dateKey = getDateKey(source, date);
          const currentSelection = next[dateKey];

          // Clear selection if the selected type no longer exists
          if (currentSelection && !typeMap?.[currentSelection]) {
            next[dateKey] = null;
            changed = true;
          }
        });
      });

      Object.keys(next).forEach((key) => {
        if (!validDateKeys.has(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    setRecentlyUpdated((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((key) => {
        if (!validStatusKeys.has(key)) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [statuses]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, COUNTDOWN_UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const sortedSources = useMemo(() => {
    return Object.entries(statuses).sort(([sourceA], [sourceB]) => sourceA.localeCompare(sourceB));
  }, [statuses]);

  const formatTimestamp = (value?: string) => {
    if (!value) return "None";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const timeAgo = formatTimeAgo(value);
    return (
      <>
        {date.toLocaleString()}
        {timeAgo && (
          <span style={{ marginLeft: "8px", opacity: 0.6, fontSize: "0.9em" }}>({timeAgo})</span>
        )}
      </>
    );
  };

  const formatBoolean = (value: boolean | undefined, fallback: string = "None") => {
    if (value === undefined) return fallback;
    return value ? "Yes" : "No";
  };

  const formatDuration = (value?: number | null) => {
    if (value === undefined || value === null) return "None";
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)} s`;
    }
    return `${value} ms`;
  };

  const formatTimeout = (value?: number | null) => {
    if (value === undefined || value === null) return "None";
    if (value >= 1000) {
      return `${Math.round(value / 1000)} s`;
    }
    return `${value} ms`;
  };

  const formatCountdown = (nextRefreshAt?: string) => {
    if (!nextRefreshAt) return null;
    const nextRefreshTime = new Date(nextRefreshAt).getTime();
    if (Number.isNaN(nextRefreshTime)) return null;

    const remainingMs = nextRefreshTime - currentTime;
    if (remainingMs <= 0) return "refreshing...";

    const seconds = Math.ceil(remainingMs / 1000);
    if (seconds < 60) {
      return `${seconds.toString().padStart(2, "0")}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
  };

  const formatTimeAgo = (timestamp?: string | null) => {
    if (!timestamp) return null;
    return dayjs(timestamp).fromNow();
  };

  const handleForceRefresh = async (source: string, date: string, dataType: string) => {
    const refreshKey = `${source}::${date}::${dataType}`;
    setRefreshing((prev) => ({ ...prev, [refreshKey]: true }));

    try {
      const response = await fetch("/api/v1/emss/dataRefresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source,
          dateWanted: date,
          dataType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Force refresh failed:", errorData);
        alert(`Force refresh failed: ${errorData.msg || errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error("Force refresh error:", error);
      alert(`Force refresh error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      // Keep the refreshing state for a brief moment to show visual feedback
      setTimeout(() => {
        setRefreshing((prev) => {
          const { [refreshKey]: _, ...rest } = prev;
          return rest;
        });
      }, 1000);
    }
  };

  const handleDownloadData = async (source: string, date: string, dataType: string) => {
    try {
      const response = await fetch(
        `/api/v1/emss/dataView?source=${encodeURIComponent(source)}&date=${encodeURIComponent(date)}&dataType=${encodeURIComponent(dataType)}`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Data download failed:", errorData);
        alert(`Data download failed: ${errorData.msg || errorData.error || response.statusText}`);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${dataType}-${source}-${date}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Data download error:", error);
      alert(`Data download error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const connectionClass =
    connectionStatus === "connected"
      ? styles.statusConnected
      : connectionStatus === "connecting" || connectionStatus === "reconnecting"
        ? styles.statusConnecting
        : styles.statusDisconnected;

  return (
    <div className={styles.container}>
      <Link to="/admin" className={styles.breadcrumb}>
        Admin Home
      </Link>
      <h1 className={styles.pageTitle}>Data Fetching Inspector</h1>
      <p className={styles.introText}>Real-time view of backend data retrieval activity.</p>

      <div className={styles.infoPanel}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Socket status:</span>
          <span className={`${styles.infoValue} ${connectionClass}`}>{connectionStatus}</span>
          {connectionError ? (
            <span className={styles.statusErrorMessage}>({connectionError})</span>
          ) : null}
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Last update:</span>
          <span className={styles.infoValue}>
            {lastUpdatedAt ? formatTimestamp(lastUpdatedAt) : "None"}
          </span>
        </div>
      </div>

      {sortedSources.length === 0 ? (
        <div className={styles.emptyState}>No active users causing data fetch activity.</div>
      ) : (
        sortedSources.map(([source, dateMap]) => (
          <section key={source} className={styles.sourceSection}>
            <h2 className={styles.sourceHeading}>
              <span style={{ color: "var(--greyish)" }}>Source:</span> {source}
            </h2>
            {Object.entries(dateMap ?? {})
              .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
              .map(([date, typeMap]) => {
                const dateKey = getDateKey(source, date);
                const typeEntries = Object.entries(typeMap ?? {})
                  .filter(([dataType]) =>
                    isDataTypeValidForSource(source as Source, dataType as StoreDataType)
                  )
                  .sort(([a], [b]) => a.localeCompare(b));
                const selectedType =
                  selectedTypes[dateKey] && typeMap?.[selectedTypes[dateKey] as string]
                    ? (selectedTypes[dateKey] as string)
                    : null;
                const selectedStatus = selectedType && typeMap ? typeMap[selectedType] : undefined;

                return (
                  <div key={`${source}-${date}`} className={styles.dateSection}>
                    <div className={styles.dateRow}>
                      <h3 className={styles.dateTitle}>{date}</h3>
                      <div className={styles.dataTypeButtons}>
                        {typeEntries.length === 0 ? (
                          <span className={styles.noDataTypes}>
                            No data types tracked for this date yet.
                          </span>
                        ) : (
                          typeEntries.map(([dataType, status]) => {
                            const statusKey = getStatusKey(source, date, dataType);
                            const buttonClasses = [styles.dataTypeButton];
                            if (selectedType === dataType) {
                              buttonClasses.push(styles.dataTypeButtonActive);
                            }
                            if (recentlyUpdated[statusKey] !== undefined) {
                              buttonClasses.push(styles.dataTypeButtonUpdated);
                            }
                            const badge = deriveStatusBadge(status);
                            const countdown = formatCountdown(status?.nextTimeoutTriggerAt);

                            return (
                              <button
                                key={statusKey}
                                type="button"
                                className={buttonClasses.join(" ")}
                                onClick={() =>
                                  setSelectedTypes((prev) => ({
                                    ...prev,
                                    [dateKey]: prev[dateKey] === dataType ? null : dataType,
                                  }))
                                }
                              >
                                {badge ? (
                                  <span
                                    className={`${styles.statusIndicator} ${badge.className}`}
                                  />
                                ) : null}
                                <span className={styles.buttonLabel}>{dataType}</span>
                                {countdown && <span className={styles.countdown}>{countdown}</span>}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {selectedType && selectedStatus && (
                      <div className={styles.statusDetails}>
                        <div className={styles.detailsHeader}>
                          <h4 className={styles.detailsHeading}>
                            <span style={{ color: "var(--greyish)" }}> Status:</span> {selectedType}
                          </h4>
                          <div className={styles.actionButtons}>
                            <button
                              type="button"
                              className={styles.downloadButton}
                              onClick={() => handleDownloadData(source, date, selectedType)}
                            >
                              Download Data
                            </button>
                            <button
                              type="button"
                              className={styles.forceRefreshButton}
                              onClick={() => handleForceRefresh(source, date, selectedType)}
                              disabled={
                                refreshing[getStatusKey(source, date, selectedType)] ||
                                selectedStatus.isFetching
                              }
                            >
                              {refreshing[getStatusKey(source, date, selectedType)] ||
                              selectedStatus.isFetching
                                ? "Refreshing..."
                                : "Force Cache Refresh"}
                            </button>
                          </div>
                        </div>
                        <div className={styles.statusGrid}>
                          {/* Current State */}
                          <div className={styles.gridSection}>
                            <h5 className={styles.sectionHeader}>Current State</h5>
                            <div className={styles.gridRows}>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Is Fetching</span>
                                <span className={styles.valueCell}>
                                  {formatBoolean(selectedStatus.isFetching, "No")}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Fetching Since</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.fetchStartedAt)}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Timeout Created At</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.timeoutCreatedAt)}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Timeout Delay</span>
                                <span className={styles.valueCell}>
                                  {formatTimeout(selectedStatus.timeoutDelayMs)}
                                </span>
                              </div>
                            </div>
                            <div className={styles.gridRow}>
                              <span className={styles.labelCell}>Next Timeout Will Trigger At</span>
                              <span className={styles.valueCell}>
                                {formatTimestamp(selectedStatus.nextTimeoutTriggerAt)}
                              </span>
                            </div>
                          </div>

                          {/* Last Fetch Cycle */}
                          <div className={styles.gridSection}>
                            <h5 className={styles.sectionHeader}>Last Fetch Cycle</h5>
                            <div className={styles.gridRows}>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Fetch Successful</span>
                                <span className={styles.valueCell}>
                                  {formatBoolean(selectedStatus.lastResultWasSuccess)}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Started At</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.lastFetchStartedAt)}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Completed At</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.lastFetchCompletedAt)}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Duration</span>
                                <span className={styles.valueCell}>
                                  {formatDuration(selectedStatus.lastFetchDurationMs)}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Last Successful At</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.lastSuccessAt)}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Last Error At</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.lastErrorAt)}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Last Error Message</span>
                                <span className={`${styles.valueCell} ${styles.valueCellError}`}>
                                  {selectedStatus.lastErrorMessage}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Last Timeout Triggered At</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.lastTimeoutTriggeredAt)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Cache Status */}
                          <div className={styles.gridSection}>
                            <h5 className={styles.sectionHeader}>Cache Status</h5>
                            <div className={styles.gridRows}>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Cache Expiration</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.cacheExpiration)}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Last Hit At</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.lastCacheHitAt)}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Last Miss At</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.lastCacheMissAt)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Socket Emissions */}
                          <div className={styles.gridSection}>
                            <h5 className={styles.sectionHeader}>Socket Emissions</h5>
                            <div className={styles.gridRows}>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Last Emit At</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.lastEmitAt)}
                                </span>
                              </div>
                              <div className={styles.gridRow}>
                                <span className={styles.labelCell}>Last Emit Skipped At</span>
                                <span className={styles.valueCell}>
                                  {formatTimestamp(selectedStatus.lastEmitSkippedAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </section>
        ))
      )}
    </div>
  );
};

export default AdminFetchStatuses;
