import { FunctionComponent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const SOURCES: Source[] = ["ISS", "TEST_EVENTS", "NBL", "ARTEMIS"];

type ValidationResult =
  | {
      ok: true;
      parsed: PcdAudioJson;
      recordingCount: number;
      dateStart: string | null;
      dateEnd: string | null;
    }
  | { ok: false; message: string };

function validateAudioJson(text: string): ValidationResult {
  if (!text.trim()) {
    return { ok: false, message: "Audio JSON is required." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, message: `Invalid JSON: ${(err as Error).message}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, message: "Audio JSON must be an object." };
  }
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.recordings)) {
    return { ok: false, message: 'Audio JSON must have a "recordings" array.' };
  }
  const recordings = obj.recordings as PcdAudioRecording[];
  const dates = recordings
    .map((r) => r.startTime?.slice(0, 10))
    .filter((d): d is string => !!d)
    .sort();
  return {
    ok: true,
    parsed: parsed as PcdAudioJson,
    recordingCount: recordings.length,
    dateStart: dates[0] ?? null,
    dateEnd: dates[dates.length - 1] ?? null,
  };
}

export const EditPcdAudioRecord: FunctionComponent = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const id = query.get("id");

  const [source, setSource] = useState<Source>("ARTEMIS");
  const [notes, setNotes] = useState<string>("");
  const [audioJsonText, setAudioJsonText] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");

  const validation = useMemo(() => validateAudioJson(audioJsonText), [audioJsonText]);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      if (id) {
        const response = await fetch(`/api/v1/db/pcdAudio/${id}`);
        const data: PcdAudioRecord = await response.json();
        setSource(data.source);
        setNotes(data.notes ?? "");
        setAudioJsonText(JSON.stringify(data.audioJson, null, 2));
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

    const payload: PcdAudioUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      source,
      notes: notes.trim() ? notes.trim() : undefined,
      audioJson: validation.parsed,
    };

    const response = await fetch(`/api/v1/db/pcdAudio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setSubmitError((body as { message?: string }).message ?? `Save failed (${response.status})`);
      return;
    }

    navigate("/admin/pcdAudio");
  };

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin/pcdAudio" className={adminCommon.backLink}>
          ← PCD Audio
        </Link>
        <h1 className={adminCommon.pageTitle}>{id ? "Edit" : "Add"} PCD Audio</h1>
        <p className={adminCommon.introText}>
          {id
            ? "Update the PCD audio record below."
            : "Paste the JSON output of fetch-audio-metadata.mjs to store the PCD audio metadata."}
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Record Details</h2>
          <div className={adminCommon.details}>
            <form onSubmit={handleSubmit} className={adminCommon.form}>
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
                <label htmlFor="notes" className={adminCommon.formLabel}>
                  Notes (optional)
                </label>
                <input
                  id="notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="e.g. Artemis 2 FD05–FD06 PCD audio"
                />
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="audioJson" className={adminCommon.formLabel}>
                  Audio JSON
                </label>
                <textarea
                  id="audioJson"
                  value={audioJsonText}
                  onChange={(e) => setAudioJsonText(e.target.value)}
                  className={adminCommon.formTextarea}
                  style={audioJsonText && !validation.ok ? { borderColor: "#f87171" } : undefined}
                  placeholder="Paste the full JSON output from fetch-audio-metadata.mjs here"
                  required
                  spellCheck={false}
                  aria-invalid={audioJsonText !== "" && !validation.ok}
                  aria-describedby="audioJsonStatus"
                />
                <span className={adminCommon.formHint}>
                  Full JSON object from{" "}
                  <code>src/server/processing/artemis2/pcd_audio/fetch-audio-metadata.mjs</code>.
                  Must contain a <code>recordings</code> array.
                </span>
                <span
                  id="audioJsonStatus"
                  className={validation.ok ? adminCommon.formHint : adminCommon.statusErrorMessage}
                  style={validation.ok ? { color: "#4ade80" } : undefined}
                >
                  {audioJsonText === ""
                    ? ""
                    : validation.ok
                      ? `✓ Valid — ${validation.recordingCount} recording${validation.recordingCount === 1 ? "" : "s"}${validation.dateStart && validation.dateEnd ? ` · ${validation.dateStart} → ${validation.dateEnd}` : ""}`
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
                  {id ? "Update Record" : "Add Record"}
                </button>
                <Link to="/admin/pcdAudio" className={adminCommon.buttonCancel}>
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
