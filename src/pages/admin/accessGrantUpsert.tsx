import { FunctionComponent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export const parseAuidsInput = (raw: string): { auids: string[]; error: string | null } => {
  if (raw.trim().length === 0) return { auids: [], error: null };

  const auids = raw.split(",").map((auid) => auid.trim());
  if (auids.some((auid) => auid.length === 0 || /[\s;"'[\]]/.test(auid))) {
    return { auids: [], error: "Enter one unquoted AUID per comma-separated entry." };
  }
  return { auids, error: null };
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
        setAuidsInput(data.auids.join(", "));
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
      id: id ? parseInt(id, 10) : undefined,
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
          ← Access Groups
        </Link>
        <h1 className={adminCommon.pageTitle}>{id ? "Edit" : "Create"} Access Group</h1>
        <p className={adminCommon.introText}>
          Define a named list of LaunchPad AUIDs. Assign this group to a media override to restrict
          it to group members.
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Group Details</h2>
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
                  Display name. Shown in the Media Override form&apos;s access group dropdown.
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
                  onBlur={() => {
                    if (!parsed.error) setAuidsInput(parsed.auids.join(", "));
                  }}
                  className={adminCommon.formTextarea}
                  rows={4}
                  spellCheck={false}
                  aria-invalid={parsed.error !== null}
                  aria-describedby="auids-format auids-status"
                />
                <span id="auids-format" className={adminCommon.formHint}>
                  Separate AUIDs with commas, for example <code>narmstra, ealdrin</code>.
                </span>
                <span
                  id="auids-status"
                  className={parsed.error ? adminCommon.statusErrorMessage : adminCommon.formHint}
                >
                  {parsed.error ??
                    `${parsed.auids.length} AUID${parsed.auids.length === 1 ? "" : "s"}`}
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
                  placeholder="Free-form notes about this access group"
                />
              </div>

              {submitError ? (
                <div className={adminCommon.statusErrorMessage}>{submitError}</div>
              ) : null}

              <div className={adminCommon.formActions}>
                <button type="submit" className={adminCommon.buttonSubmit}>
                  {id ? "Update Group" : "Create Group"}
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
