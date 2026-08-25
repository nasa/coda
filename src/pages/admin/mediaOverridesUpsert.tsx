import { FunctionComponent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const PUBLIC_GRANT_VALUE = "";

export const EditMediaOverridesRecord: FunctionComponent = () => {
  const [date, setDate] = useState<string>("");
  const [matchMode, setMatchMode] = useState<MediaOverrideMatchMode>("exact");
  const [source, setSource] = useState<Source>("ARTEMIS");
  const [type, setType] = useState<MediaMedium>("video");
  const [url, setURL] = useState<string>("");
  const [accessGrantId, setAccessGrantId] = useState<string>(PUBLIC_GRANT_VALUE);
  const [accessGrants, setAccessGrants] = useState<AccessGrantListItem[]>([]);
  const [submitError, setSubmitError] = useState<string>("");
  const navigate = useNavigate();
  const query = useQuery();
  const id = query.get("id");
  const resolvedExample = useMemo(
    () => (matchMode === "daily" && date ? url.replace("{date}", date) : ""),
    [date, matchMode, url]
  );

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      const grantsRes = await fetch(`/api/v1/db/accessGrants`);
      if (grantsRes.ok) {
        setAccessGrants(await grantsRes.json());
      }
      if (id) {
        const response = await fetch(`/api/v1/db/mediaOverrides/${id}`);
        const data: MediaOverride = await response.json();
        setDate(data.date);
        setMatchMode(data.matchMode ?? "exact");
        setSource(data.source);
        setType(data.type);
        setURL(data.url);
        setAccessGrantId(
          typeof data.accessGrantId === "number" ? String(data.accessGrantId) : PUBLIC_GRANT_VALUE
        );
      }
    })();
  }, [navigate, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    const data: MediaOverrideUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      date: date,
      matchMode,
      source: source as Source,
      type: type as "video" | "photo" | "transcript" | "audio",
      url: url,
      accessGrantId: accessGrantId === PUBLIC_GRANT_VALUE ? null : parseInt(accessGrantId, 10),
    };
    const response = await fetch(`/api/v1/db/mediaOverrides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setSubmitError(body.message ?? `Save failed (${response.status})`);
      return;
    }
    navigate("/admin/mediaOverrides");
  };

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin/mediaOverrides" className={adminCommon.backLink}>
          ← Media Overrides
        </Link>
        <h1 className={adminCommon.pageTitle}>{id ? "Edit" : "Create"} Media Override</h1>
        <p className={adminCommon.introText}>
          {id
            ? "Modify the media override details below."
            : "Enter the media override details to configure an alternate media source."}
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Override Details</h2>
          <div className={adminCommon.details}>
            <form onSubmit={handleSubmit} className={adminCommon.form}>
              <div className={adminCommon.formGroup}>
                <label htmlFor="matchMode" className={adminCommon.formLabel}>
                  Date Matching
                </label>
                <select
                  id="matchMode"
                  value={matchMode}
                  onChange={(e) => setMatchMode(e.target.value as MediaOverrideMatchMode)}
                  className={adminCommon.formSelect}
                  required
                >
                  <option value="exact">Exact date</option>
                  <option value="daily">Daily from start date</option>
                </select>
                <span className={adminCommon.formHint}>
                  Daily overrides apply on and after the start date until replaced by a newer daily
                  override. An exact override takes precedence for its date.
                </span>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="date" className={adminCommon.formLabel}>
                  {matchMode === "daily" ? "Start Date" : "Date"}
                </label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={adminCommon.formInput}
                  required
                />
                <span className={adminCommon.formHint}>
                  {matchMode === "daily"
                    ? "Inclusive: the template will not be used before this date."
                    : "The override applies only to this date."}
                </span>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="source" className={adminCommon.formLabel}>
                  Source
                </label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as Source)}
                  className={adminCommon.formSelect}
                  required
                >
                  <option value="ARTEMIS">ARTEMIS</option>
                  <option value="ISS">ISS</option>
                  <option value="NBL">NBL</option>
                  <option value="TEST_EVENTS">TEST_EVENTS</option>
                </select>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="type" className={adminCommon.formLabel}>
                  Media Type
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => {
                    const nextType = e.target.value as MediaMedium;
                    setType(nextType);
                    if (nextType !== "video") setAccessGrantId(PUBLIC_GRANT_VALUE);
                  }}
                  className={adminCommon.formSelect}
                  required
                >
                  <option value="video">video</option>
                  <option value="photo">photo</option>
                  <option value="transcript">transcript</option>
                  <option value="audio">audio</option>
                </select>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="url" className={adminCommon.formLabel}>
                  URL
                </label>
                <textarea
                  id="url"
                  value={url}
                  onChange={(e) => setURL(e.target.value)}
                  className={adminCommon.formTextarea}
                  placeholder={
                    matchMode === "daily"
                      ? "https://example.com/media/{date}"
                      : "https://example.com/media/2026-08-25"
                  }
                  required
                />
                <span className={adminCommon.formHint}>
                  {matchMode === "daily"
                    ? "Include exactly one {date} token. CODA replaces it with the requested yyyy-mm-dd date."
                    : "The alternate base URL for retrieving media."}
                </span>
                {resolvedExample && url.includes("{date}") ? (
                  <span className={adminCommon.formHint}>Example: {resolvedExample}</span>
                ) : null}
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="accessGrant" className={adminCommon.formLabel}>
                  Restrict to Access Grant
                </label>
                <select
                  id="accessGrant"
                  value={accessGrantId}
                  onChange={(e) => setAccessGrantId(e.target.value)}
                  className={adminCommon.formSelect}
                  disabled={type !== "video"}
                >
                  <option value={PUBLIC_GRANT_VALUE}>Public — no restriction</option>
                  {accessGrants.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {g.name} ({g.auidCount} AUID{g.auidCount === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
                <span className={adminCommon.formHint}>
                  {type === "video" ? (
                    <>
                      When a grant is selected, only users whose AUID is in that grant will receive
                      this override (delivered via the restricted REST endpoint, not the public
                      socket feed). Manage grants on the{" "}
                      <Link to="/admin/accessGrants">Access Grants</Link> page.
                    </>
                  ) : (
                    "Restricted delivery is currently supported only for video overrides."
                  )}
                </span>
              </div>

              {submitError && <div className={adminCommon.statusErrorMessage}>{submitError}</div>}

              <div className={adminCommon.formActions}>
                <button type="submit" className={adminCommon.buttonSubmit}>
                  {id ? "Update Override" : "Create Override"}
                </button>
                <Link to="/admin/mediaOverrides" className={adminCommon.buttonCancel}>
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
};
