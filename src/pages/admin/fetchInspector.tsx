import isEqual from "lodash/isEqual";
import { FunctionComponent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import { isDataTypeValidForSourceAndDate } from "utils/sourceDataTypeMap";
import adminCommon from "./adminCommon.module.css";
import styles from "./fetchInspector.module.css";

dayjs.extend(relativeTime);

const mtxVideoMaxAgeDays = parseInt(import.meta.env.VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS, 10);

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
      className: adminCommon.badgeNeutral,
    };
  }

  if (status.isFetching) {
    return {
      label: "Fetching",
      className: adminCommon.badgeFetching,
    };
  }

  if (status.lastOperationSuccess === false) {
    return {
      label: "Error",
      className: adminCommon.badgeError,
    };
  }

  if (status.lastOperationSuccess) {
    return {
      label: "Success",
      className: adminCommon.badgeSuccess,
    };
  }

  return {
    label: "Ready",
    className: adminCommon.badgeNeutral,
  };
};

const AdminFetchStatuses: FunctionComponent = () => {
  const navigate = useNavigate();
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
        socket.emit("joinInspector");
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
        socket.emit("leaveInspector");
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
    })();
  }, [navigate]);

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

  const formatDateLabel = (date: string) => {
    return date === "notDateDependent" ? "Not Date Dependent" : date;
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
      ? adminCommon.statusConnected
      : connectionStatus === "connecting" || connectionStatus === "reconnecting"
        ? adminCommon.statusConnecting
        : adminCommon.statusDisconnected;

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin" className={adminCommon.backLink}>
          ← Admin
        </Link>
        <h1 className={adminCommon.pageTitle}>Data Fetching Inspector</h1>
        <p className={adminCommon.introText}>Real-time view of backend data retrieval activity.</p>

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

        {sortedSources.length === 0 ? (
          <div className={adminCommon.emptyState}>No active users causing data fetch activity.</div>
        ) : (
          sortedSources.map(([source, dateMap]) => (
            <section
              key={source}
              className={adminCommon.section}
              aria-labelledby={`source-${source}`}
            >
              <h2 id={`source-${source}`} className={adminCommon.sectionHeading}>
                <span className={adminCommon.sectionHeadingMuted}>Source:</span> {source}
              </h2>
              {Object.entries(dateMap ?? {})
                .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                .map(([date, typeMap]) => {
                  const dateKey = getDateKey(source, date);
                  const typeEntries = Object.entries(typeMap ?? {})
                    .filter(([dataType]) =>
                      isDataTypeValidForSourceAndDate(
                        source as Source,
                        dataType as StoreDataType,
                        date,
                        mtxVideoMaxAgeDays
                      )
                    )
                    .sort(([a], [b]) => a.localeCompare(b));
                  const selectedType =
                    selectedTypes[dateKey] && typeMap?.[selectedTypes[dateKey] as string]
                      ? (selectedTypes[dateKey] as string)
                      : null;
                  const selectedStatus =
                    selectedType && typeMap ? typeMap[selectedType] : undefined;

                  return (
                    <div key={`${source}-${date}`} className={styles.dateSection}>
                      <div className={styles.dateRow}>
                        <h3 className={styles.dateTitle}>{formatDateLabel(date)}</h3>
                        <div
                          className={styles.dataTypeButtons}
                          role="group"
                          aria-label={`Data types for ${formatDateLabel(date)}`}
                        >
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
                                  aria-pressed={selectedType === dataType}
                                >
                                  {badge ? (
                                    <span
                                      className={`${adminCommon.statusIndicator} ${badge.className}`}
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                  <span className={styles.buttonLabel}>{dataType}</span>
                                  {countdown && (
                                    <span className={styles.countdown}>{countdown}</span>
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {selectedType && selectedStatus && (
                        <div className={adminCommon.details}>
                          <header className={adminCommon.detailsHeader}>
                            <h4 className={styles.detailsHeading}>
                              <span className={adminCommon.sectionHeadingMuted}>Status:</span>{" "}
                              {selectedType}
                            </h4>
                            <div className={adminCommon.actionButtons}>
                              <button
                                type="button"
                                className={adminCommon.button}
                                onClick={() => handleDownloadData(source, date, selectedType)}
                              >
                                Download Data
                              </button>
                              <button
                                type="button"
                                className={adminCommon.button}
                                onClick={() => handleForceRefresh(source, date, selectedType)}
                                disabled={
                                  refreshing[getStatusKey(source, date, selectedType)] ||
                                  selectedStatus.isFetching
                                }
                                aria-busy={
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
                          </header>
                          <div className={adminCommon.grid}>
                            {/* Current State */}
                            <div className={adminCommon.gridSection}>
                              <h5 className={adminCommon.gridSectionHeader}>Current State</h5>
                              <dl className={adminCommon.definitionList}>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Is Fetching</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatBoolean(selectedStatus.isFetching, "No")}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Fetching Since</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.fetchStartedAt)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Timeout Created At</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.timeoutCreatedAt)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Timeout Delay</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimeout(selectedStatus.timeoutDelayMs)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>
                                    Next Timeout Will Trigger At
                                  </dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.nextTimeoutTriggerAt)}
                                  </dd>
                                </div>
                              </dl>
                            </div>

                            {/* Last Fetch Cycle */}
                            <div className={adminCommon.gridSection}>
                              <h5 className={adminCommon.gridSectionHeader}>Last Fetch Cycle</h5>
                              <dl className={adminCommon.definitionList}>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Fetch Successful</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatBoolean(selectedStatus.lastOperationSuccess)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Started At</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.lastOperationStartedAt)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Completed At</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.lastOperationCompletedAt)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Duration</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatDuration(selectedStatus.lastOperationDurationMs)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Last Successful At</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.lastSuccessAt)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Last Error At</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.lastErrorAt)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Last Error Message</dt>
                                  <dd
                                    className={`${adminCommon.definitionValue} ${adminCommon.definitionValueError}`}
                                  >
                                    {selectedStatus.lastErrorMessage}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>
                                    Last Timeout Triggered At
                                  </dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.lastTimeoutTriggeredAt)}
                                  </dd>
                                </div>
                              </dl>
                            </div>

                            {/* Cache Status */}
                            <div className={adminCommon.gridSection}>
                              <h5 className={adminCommon.gridSectionHeader}>Cache Status</h5>
                              <dl className={adminCommon.definitionList}>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Cache Expiration</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.cacheExpiration)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Last Hit At</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.lastCacheHitAt)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Last Miss At</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.lastCacheMissAt)}
                                  </dd>
                                </div>
                              </dl>
                            </div>

                            {/* Socket Emissions */}
                            <div className={adminCommon.gridSection}>
                              <h5 className={adminCommon.gridSectionHeader}>Socket Emissions</h5>
                              <dl className={adminCommon.definitionList}>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>Last Emit At</dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.lastEmitAt)}
                                  </dd>
                                </div>
                                <div className={adminCommon.definitionRow}>
                                  <dt className={adminCommon.definitionTerm}>
                                    Last Emit Skipped At
                                  </dt>
                                  <dd className={adminCommon.definitionValue}>
                                    {formatTimestamp(selectedStatus.lastEmitSkippedAt)}
                                  </dd>
                                </div>
                              </dl>
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
    </main>
  );
};

export default AdminFetchStatuses;
