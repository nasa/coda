import { FunctionComponent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const SOURCES: Source[] = ["ISS", "TEST_EVENTS", "NBL", "ARTEMIS", "ARTEMIS_TRAINING"];
const MEDIA_TYPES: AssetOverrideMediaType[] = ["photo-time", "video-channel"];

const TIME_OFFSET_RE = /^[+-]\d{2}:\d{2}:\d{2}$/;

type ValidationResult =
  | { ok: true; parsed: Record<string, string | number>; entryCount: number }
  | { ok: false; message: string };

function validateOverrideJson(text: string, mediaType: AssetOverrideMediaType): ValidationResult {
  if (!text.trim()) {
    return { ok: false, message: "Override JSON is required." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, message: `Invalid JSON: ${(err as Error).message}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, message: "Override JSON must be an object keyed by NASA ID." };
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) {
    return { ok: false, message: "Override JSON must contain at least one entry." };
  }
  for (const [key, value] of entries) {
    if (mediaType === "photo-time") {
      if (typeof value !== "string" || !TIME_OFFSET_RE.test(value)) {
        return {
          ok: false,
          message: `Entry "${key}" must be a string in ±hh:mm:ss format (got ${JSON.stringify(value)}).`,
        };
      }
    } else {
      if (!(typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 8)) {
        return {
          ok: false,
          message: `Entry "${key}" must be a number 1–8 (got ${JSON.stringify(value)}).`,
        };
      }
    }
  }
  return {
    ok: true,
    parsed: parsed as Record<string, string | number>,
    entryCount: entries.length,
  };
}

export const EditAssetOverrideRecord: FunctionComponent = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const id = query.get("id");

  const [mediaType, setMediaType] = useState<AssetOverrideMediaType>("photo-time");
  const [source, setSource] = useState<Source>("ARTEMIS");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [overrideJsonText, setOverrideJsonText] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");

  const validation = useMemo(
    () => validateOverrideJson(overrideJsonText, mediaType),
    [overrideJsonText, mediaType]
  );

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      if (id) {
        const response = await fetch(`/api/v1/db/assetOverrides/${id}`);
        const data: AssetOverride = await response.json();
        setMediaType(data.mediaType);
        setSource(data.source);
        setStartDate(data.startDate);
        setEndDate(data.endDate);
        setNotes(data.notes ?? "");
        setOverrideJsonText(JSON.stringify(data.overrideJson, null, 2));
      }
    })();
  }, [navigate, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!validation.ok) {
      setSubmitError(validation.message);
      return;
    }

    const payload: AssetOverrideUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      mediaType,
      source,
      startDate,
      endDate,
      overrideJson: validation.parsed,
      notes: notes.trim() ? notes.trim() : undefined,
    };
    const response = await fetch(`/api/v1/db/assetOverrides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setSubmitError(body.message ?? `Save failed (${response.status})`);
      return;
    }
    navigate("/admin/assetOverrides");
  };

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin/assetOverrides" className={adminCommon.backLink}>
          ← Per-Asset Overrides
        </Link>
        <h1 className={adminCommon.pageTitle}>{id ? "Edit" : "Create"} Asset Override</h1>
        <p className={adminCommon.introText}>
          {id
            ? "Modify the asset override record below."
            : "Paste the generator script's JSON output to create per-asset overrides."}
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Override Details</h2>
          <div className={adminCommon.details}>
            <form onSubmit={handleSubmit} className={adminCommon.form}>
              <div className={adminCommon.formGroup}>
                <label htmlFor="mediaType" className={adminCommon.formLabel}>
                  Media Type
                </label>
                <select
                  id="mediaType"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as AssetOverrideMediaType)}
                  className={adminCommon.formSelect}
                  required
                >
                  {MEDIA_TYPES.map((mt) => (
                    <option key={mt} value={mt}>
                      {mt}
                    </option>
                  ))}
                </select>
                <span className={adminCommon.formHint}>
                  photo: per-photo timestamp shift (±hh:mm:ss). video: per-video CODA channel
                  number.
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
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="startDate" className={adminCommon.formLabel}>
                  Start Date
                </label>
                <input
                  id="startDate"
                  type="text"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="yyyy-mm-dd"
                  required
                />
                <span className={adminCommon.formHint}>Inclusive. Format: yyyy-mm-dd</span>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="endDate" className={adminCommon.formLabel}>
                  End Date
                </label>
                <input
                  id="endDate"
                  type="text"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="yyyy-mm-dd"
                  required
                />
                <span className={adminCommon.formHint}>Inclusive. Format: yyyy-mm-dd</span>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="notes" className={adminCommon.formLabel}>
                  Notes (optional)
                </label>
                <input
                  id="notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="e.g. Artemis 2 photo timezones"
                />
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="overrideJson" className={adminCommon.formLabel}>
                  Override JSON
                </label>
                <pre
                  style={{
                    fontSize: "0.75rem",
                    color: "#94a3b8",
                    background: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: 4,
                    padding: "8px 12px",
                    margin: 0,
                    overflowX: "auto",
                    whiteSpace: "pre",
                  }}
                >
                  {mediaType === "photo-time"
                    ? `{\n  "jsc2026e018901": "-05:00:00",\n  "jsc2026e018902": "-05:00:00"\n}`
                    : `{\n  "art002m2000911749": 7,\n  "art002m1500911830": 5\n}`}
                </pre>
                <textarea
                  id="overrideJson"
                  value={overrideJsonText}
                  onChange={(e) => setOverrideJsonText(e.target.value)}
                  className={adminCommon.formTextarea}
                  style={
                    overrideJsonText && !validation.ok ? { borderColor: "#f87171" } : undefined
                  }
                  placeholder={
                    mediaType === "photo-time"
                      ? '{ "jsc2026e018901": "-05:00:00", ... }'
                      : '{ "art002m2000911749": 7, ... }'
                  }
                  required
                  spellCheck={false}
                  aria-invalid={overrideJsonText !== "" && !validation.ok}
                  aria-describedby="overrideJsonStatus"
                />
                <span className={adminCommon.formHint}>
                  JSON object keyed by NASA ID. Values are{" "}
                  {mediaType === "photo-time"
                    ? "±hh:mm:ss offset strings."
                    : "{ channel: 1–8 } objects."}
                </span>
                <span
                  id="overrideJsonStatus"
                  className={validation.ok ? adminCommon.formHint : adminCommon.statusErrorMessage}
                  style={validation.ok ? { color: "#4ade80" } : undefined}
                >
                  {overrideJsonText === ""
                    ? ""
                    : validation.ok
                      ? `✓ Valid — ${validation.entryCount} entr${validation.entryCount === 1 ? "y" : "ies"}`
                      : validation.message}
                </span>
                {submitError && (
                  <span className={adminCommon.statusErrorMessage}>{submitError}</span>
                )}
              </div>

              <div className={adminCommon.formActions}>
                <button
                  type="submit"
                  className={adminCommon.buttonSubmit}
                  disabled={!validation.ok}
                >
                  {id ? "Update Override" : "Create Override"}
                </button>
                <Link to="/admin/assetOverrides" className={adminCommon.buttonCancel}>
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
