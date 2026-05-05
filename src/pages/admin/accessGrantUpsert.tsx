import { FunctionComponent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const parseAuidsInput = (raw: string): { auids: string[]; error: string | null } => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { auids: [], error: null };

  // Try JSON first
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "string")) {
        return { auids: [], error: "JSON must be an array of strings" };
      }
      return {
        auids: parsed.map((s: string) => s.trim()).filter((s: string) => s.length > 0),
        error: null,
      };
    } catch (e) {
      return { auids: [], error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  // Otherwise treat as line- or comma-separated
  const split = trimmed
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { auids: split, error: null };
};

export const EditAccessGrantRecord: FunctionComponent = () => {
  const [name, setName] = useState<string>("");
  const [auidsInput, setAuidsInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navigate = useNavigate();
  const query = useQuery();
  const id = query.get("id");

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      if (id) {
        const response = await fetch(`/api/v1/db/accessGrants/${id}`);
        if (!response.ok) return;
        const data: AccessGrant = await response.json();
        setName(data.name);
        setAuidsInput(JSON.stringify(data.auids, null, 2));
        setNotes(data.notes ?? "");
      }
    })();
  }, [navigate, id]);

  const parsed = useMemo(() => parseAuidsInput(auidsInput), [auidsInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (parsed.error) {
      setSubmitError(parsed.error);
      return;
    }
    const data: AccessGrantUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      name: name.trim(),
      auids: parsed.auids,
      notes: notes.trim() || undefined,
    };
    const res = await fetch(`/api/v1/db/accessGrants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: res.statusText }));
      setSubmitError(body.message ?? res.statusText);
      return;
    }
    navigate("/admin/accessGrants");
  };

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin/accessGrants" className={adminCommon.backLink}>
          ← Access Grants
        </Link>
        <h1 className={adminCommon.pageTitle}>{id ? "Edit" : "Create"} Access Grant</h1>
        <p className={adminCommon.introText}>
          Define a named list of LaunchPad AUIDs. Attach this grant to a Media Override to restrict
          delivery of that override.
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Grant Details</h2>
          <div className={adminCommon.details}>
            <form onSubmit={handleSubmit} className={adminCommon.form}>
              <div className={adminCommon.formGroup}>
                <label htmlFor="name" className={adminCommon.formLabel}>
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="e.g. Artemis Video Reviewers"
                  required
                />
                <span className={adminCommon.formHint}>
                  Display name. Shown in the Media Override form&apos;s grant dropdown.
                </span>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="auids" className={adminCommon.formLabel}>
                  AUIDs
                </label>
                <textarea
                  id="auids"
                  value={auidsInput}
                  onChange={(e) => setAuidsInput(e.target.value)}
                  className={adminCommon.formTextarea}
                  rows={10}
                  placeholder={`Either JSON array:\n["narmstra", "ealdrin"]\n\nor whitespace/comma-separated:\nnarmstra, ealdrin`}
                />
                <span className={adminCommon.formHint}>
                  Parsed: {parsed.auids.length} AUID{parsed.auids.length === 1 ? "" : "s"}
                  {parsed.error ? ` — error: ${parsed.error}` : ""}
                </span>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="notes" className={adminCommon.formLabel}>
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={adminCommon.formTextarea}
                  rows={3}
                  placeholder="Free-form notes about this access grant"
                />
              </div>

              {submitError ? (
                <div className={adminCommon.statusErrorMessage}>{submitError}</div>
              ) : null}

              <div className={adminCommon.formActions}>
                <button type="submit" className={adminCommon.buttonSubmit}>
                  {id ? "Update Grant" : "Create Grant"}
                </button>
                <Link to="/admin/accessGrants" className={adminCommon.buttonCancel}>
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
