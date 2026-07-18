import { FunctionComponent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";
import styles from "./cacheManager.module.css";

dayjs.extend(relativeTime);

// Known cache sources (encoded in the folder path) and data types (cacheKey).
// Kept in sync with dataRetrievalScheduler's cache paths and fetch configs.
const SOURCES = ["ISS", "TEST_EVENTS", "NBL", "ARTEMIS", "allDates"];
const DATA_TYPES = ["daynight", "videos", "photos", "wikiEvas", "wikiTestEvents", "mtxvideo"];

type PurgeParams = { source?: string; cacheKey?: string; month?: string; olderThanDays?: number };

/** Format a byte count into a human-readable KB/MB/GB string. */
const formatBytes = (bytes: number): string => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const formatAccess = (value: string | null): string => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString()} (${dayjs(value).fromNow()})`;
};

const AdminCacheManager: FunctionComponent = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Purge-by-source controls
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [sourceDays, setSourceDays] = useState<string>("30");

  // Purge-by-data-type controls
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [typeDays, setTypeDays] = useState<string>("");

  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      fetchStats();
    })();
  }, [navigate]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/db/cache/stats");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      setStats(await response.json());
    } catch (e) {
      console.error("Error fetching cache stats:", e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Shared handler for all purge actions. When dryRun is true it previews the
   * count; otherwise it deletes (after a confirm). Recomputing the full report is
   * expensive (it scans octet_length over the whole table), so instead of
   * re-fetching we optimistically patch the local stats via `optimistic` — pass a
   * patcher when the affected row's exact count/bytes are known. Use the manual
   * Refresh button for an exact recompute.
   */
  const runPurge = async (
    params: PurgeParams,
    dryRun: boolean,
    optimistic?: (prev: CacheStats) => CacheStats
  ) => {
    if (busy || loading) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/db/cache/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, dryRun }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(`Error: ${data.message}`);
        return;
      }
      if (dryRun) {
        setMessage(`${data.count.toLocaleString()} entries would be deleted.`);
      } else if (optimistic) {
        setStats((prev) => (prev ? optimistic(prev) : prev));
        setMessage(
          `Deleted ${data.count.toLocaleString()} entries. Other groupings may be approximate ` +
            `until you Refresh.`
        );
      } else {
        // No row-level info to patch (e.g. an age-based bulk purge) — leave the
        // report as-is and prompt a manual refresh for exact numbers.
        setMessage(
          `Deleted ${data.count.toLocaleString()} entries. Click Refresh to recompute the report.`
        );
      }
    } catch (e) {
      setMessage(`Error: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  // Build the purge params for a form section, omitting empty/invalid fields.
  const buildParams = (source: string, cacheKey: string, days: string): PurgeParams => {
    const params: PurgeParams = {};
    if (source) params.source = source;
    if (cacheKey) params.cacheKey = cacheKey;
    const parsedDays = parseInt(days, 10);
    if (!Number.isNaN(parsedDays) && parsedDays >= 0) params.olderThanDays = parsedDays;
    return params;
  };

  const handlePurge = (
    params: PurgeParams,
    label: string,
    optimistic?: (prev: CacheStats) => CacheStats
  ) => {
    if (!confirm(`Permanently delete cache entries matching ${label}? This cannot be undone.`)) {
      return;
    }
    runPurge(params, false, optimistic);
  };

  // Group months into collapsible years; the empty-month "allDates" bucket has no
  // year and is surfaced as its own standalone row.
  const { years, allDatesBucket } = useMemo(() => {
    const map = new Map<string, CacheMonthStat[]>();
    let allDates: CacheMonthStat | null = null;
    for (const m of stats?.byMonth ?? []) {
      if (!m.month) {
        allDates = m;
        continue;
      }
      const year = m.month.slice(0, 4);
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(m);
    }
    const grouped = [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, months]) => ({
        year,
        months,
        count: months.reduce((sum, m) => sum + m.count, 0),
        totalBytes: months.reduce((sum, m) => sum + m.totalBytes, 0),
      }));
    return { years: grouped, allDatesBucket: allDates };
  }, [stats]);

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin" className={adminCommon.backLink}>
          ← Admin
        </Link>
        <h1 className={adminCommon.pageTitle}>Cache Manager</h1>
        <p className={adminCommon.introText}>
          Report on the upstream data cache (<code>cache_db</code>) by source, data type, and date,
          and manually purge stale entries. Cleanup here is admin-triggered only — the cache is
          never evicted automatically. Computing sizes scans the whole table, so the report is only
          recomputed on demand — after a purge the numbers are updated locally; use Refresh for an
          exact recompute.
        </p>

        <div className={adminCommon.actionButtons}>
          <button
            type="button"
            className={adminCommon.button}
            disabled={loading || busy}
            onClick={fetchStats}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {loading ? (
          <section className={adminCommon.section}>
            <div className={styles.spinnerWrap}>
              <span className={styles.spinner} aria-hidden="true" />
              <span>Computing cache statistics…</span>
            </div>
          </section>
        ) : (
          <>
            {/* Overview */}
            <section className={adminCommon.section} aria-labelledby="overview-heading">
              <h2 id="overview-heading" className={adminCommon.sectionHeading}>
                Overview
              </h2>
              <div className={adminCommon.details}>
                <dl className={adminCommon.definitionList}>
                  <div className={adminCommon.definitionRow}>
                    <dt className={adminCommon.definitionTerm}>Total Entries</dt>
                    <dd className={adminCommon.definitionValue}>
                      {stats ? stats.totals.count.toLocaleString() : "—"}
                    </dd>
                  </div>
                  <div className={adminCommon.definitionRow}>
                    <dt className={adminCommon.definitionTerm}>Total Size</dt>
                    <dd className={adminCommon.definitionValue}>
                      {stats ? formatBytes(stats.totals.totalBytes) : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            {/* By Source */}
            <section className={adminCommon.section} aria-labelledby="by-source-heading">
              <h2 id="by-source-heading" className={adminCommon.sectionHeading}>
                By Source
              </h2>
              <div className={adminCommon.details}>
                {stats && stats.bySource.length > 0 ? (
                  stats.bySource.map((s) => (
                    <div key={s.source || "(none)"} className={styles.row}>
                      <span className={styles.rowName}>{s.source || "(none)"}</span>
                      <span className={styles.rowMeta}>
                        {s.count.toLocaleString()} entries · {formatBytes(s.totalBytes)} · oldest
                        access {formatAccess(s.oldestAccess)} · newest{" "}
                        {formatAccess(s.newestAccess)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className={adminCommon.emptyState}>No cache entries.</p>
                )}
              </div>
            </section>

            {/* By Data Type */}
            <section className={adminCommon.section} aria-labelledby="by-type-heading">
              <h2 id="by-type-heading" className={adminCommon.sectionHeading}>
                By Data Type
              </h2>
              <div className={adminCommon.details}>
                {stats && stats.byType.length > 0 ? (
                  stats.byType.map((t) => (
                    <div key={t.cacheKey || "(none)"} className={styles.row}>
                      <span className={styles.rowName}>{t.cacheKey || "(none)"}</span>
                      <span className={styles.rowMeta}>
                        {t.count.toLocaleString()} entries · {formatBytes(t.totalBytes)}
                      </span>
                      {t.cacheKey && (
                        <button
                          type="button"
                          className={styles.purgeButton}
                          disabled={busy}
                          onClick={() =>
                            handlePurge(
                              { cacheKey: t.cacheKey },
                              `data type "${t.cacheKey}"`,
                              (prev) => ({
                                ...prev,
                                totals: {
                                  count: prev.totals.count - t.count,
                                  totalBytes: prev.totals.totalBytes - t.totalBytes,
                                },
                                byType: prev.byType.filter((x) => x.cacheKey !== t.cacheKey),
                              })
                            )
                          }
                        >
                          Purge
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className={adminCommon.emptyState}>No cache entries.</p>
                )}
              </div>
            </section>

            {/* By Month (grouped into collapsible years) */}
            <section className={adminCommon.section} aria-labelledby="by-month-heading">
              <h2 id="by-month-heading" className={adminCommon.sectionHeading}>
                By Month
              </h2>
              <div className={adminCommon.details}>
                {years.length === 0 && !allDatesBucket ? (
                  <p className={adminCommon.emptyState}>No cache entries.</p>
                ) : (
                  <>
                    {years.map((y) => (
                      <details key={y.year} className={styles.year}>
                        <summary className={styles.yearSummary}>
                          <span className={styles.yearLabel}>{y.year}</span>
                          <span className={styles.yearMeta}>
                            {y.count.toLocaleString()} entries · {formatBytes(y.totalBytes)} ·{" "}
                            {y.months.length} month{y.months.length !== 1 ? "s" : ""}
                          </span>
                        </summary>
                        <div className={styles.yearBody}>
                          {y.months.map((m) => (
                            <div key={m.month} className={styles.row}>
                              <span className={styles.rowName}>{m.month}</span>
                              <span className={styles.rowMeta}>
                                {m.count.toLocaleString()} entries · {formatBytes(m.totalBytes)}
                              </span>
                              <button
                                type="button"
                                className={styles.purgeButton}
                                disabled={busy}
                                onClick={() =>
                                  handlePurge({ month: m.month }, `month ${m.month}`, (prev) => ({
                                    ...prev,
                                    totals: {
                                      count: prev.totals.count - m.count,
                                      totalBytes: prev.totals.totalBytes - m.totalBytes,
                                    },
                                    byMonth: prev.byMonth.filter((x) => x.month !== m.month),
                                  }))
                                }
                              >
                                Purge
                              </button>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                    {allDatesBucket && (
                      <div className={styles.row}>
                        <span className={styles.rowName}>(all dates)</span>
                        <span className={styles.rowMeta}>
                          {allDatesBucket.count.toLocaleString()} entries ·{" "}
                          {formatBytes(allDatesBucket.totalBytes)}
                        </span>
                        <button
                          type="button"
                          className={styles.purgeButton}
                          disabled={busy}
                          onClick={() =>
                            handlePurge({ source: "allDates" }, "the all-dates bucket", (prev) => ({
                              ...prev,
                              totals: {
                                count: prev.totals.count - allDatesBucket.count,
                                totalBytes: prev.totals.totalBytes - allDatesBucket.totalBytes,
                              },
                              byMonth: prev.byMonth.filter((x) => x.month !== ""),
                              bySource: prev.bySource.filter((x) => x.source !== "allDates"),
                            }))
                          }
                        >
                          Purge
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* Cleanup (age-based bulk purge) */}
            <section className={adminCommon.section} aria-labelledby="cleanup-heading">
              <h2 id="cleanup-heading" className={adminCommon.sectionHeading}>
                Cleanup
              </h2>
              <div className={adminCommon.details}>
                {message && <p className={adminCommon.resultMessage}>{message}</p>}

                {/* Purge by source + age */}
                <div className={adminCommon.formGroup}>
                  <span className={adminCommon.formLabel}>Purge by source & inactivity age</span>
                  <div className={adminCommon.actionButtons} style={{ alignItems: "flex-end" }}>
                    <select
                      className={adminCommon.formSelect}
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      aria-label="Source to purge"
                    >
                      <option value="">All sources</option>
                      {SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      className={adminCommon.formInput}
                      type="number"
                      min={0}
                      value={sourceDays}
                      onChange={(e) => setSourceDays(e.target.value)}
                      placeholder="Not accessed in N days"
                      aria-label="Not accessed in N days"
                      style={{ width: "200px" }}
                    />
                    <button
                      type="button"
                      className={adminCommon.button}
                      disabled={busy}
                      onClick={() => runPurge(buildParams(sourceFilter, "", sourceDays), true)}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className={`${adminCommon.button} ${adminCommon.buttonPrimary}`}
                      disabled={busy}
                      onClick={() =>
                        handlePurge(
                          buildParams(sourceFilter, "", sourceDays),
                          `source "${sourceFilter || "All"}"${
                            sourceDays ? ` not accessed in ${sourceDays} days` : ""
                          }`
                        )
                      }
                    >
                      Purge
                    </button>
                  </div>
                  <span className={adminCommon.formHint}>
                    Leave days blank to purge all entries for the selected source. Selecting All
                    sources requires a day threshold.
                  </span>
                </div>

                {/* Purge by data type + age */}
                <div className={adminCommon.formGroup} style={{ marginTop: "20px" }}>
                  <span className={adminCommon.formLabel}>Purge by data type & inactivity age</span>
                  <div className={adminCommon.actionButtons} style={{ alignItems: "flex-end" }}>
                    <select
                      className={adminCommon.formSelect}
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      aria-label="Data type to purge"
                    >
                      <option value="">All data types</option>
                      {DATA_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      className={adminCommon.formInput}
                      type="number"
                      min={0}
                      value={typeDays}
                      onChange={(e) => setTypeDays(e.target.value)}
                      placeholder="Not accessed in N days (optional)"
                      aria-label="Not accessed in N days (optional)"
                      style={{ width: "260px" }}
                    />
                    <button
                      type="button"
                      className={adminCommon.button}
                      disabled={busy}
                      onClick={() => runPurge(buildParams("", typeFilter, typeDays), true)}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className={`${adminCommon.button} ${adminCommon.buttonPrimary}`}
                      disabled={busy}
                      onClick={() =>
                        handlePurge(
                          buildParams("", typeFilter, typeDays),
                          `data type "${typeFilter || "All"}"${
                            typeDays ? ` not accessed in ${typeDays} days` : ""
                          }`
                        )
                      }
                    >
                      Purge
                    </button>
                  </div>
                  <span className={adminCommon.formHint}>
                    Selecting All data types requires a day threshold.
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
};

export default AdminCacheManager;
