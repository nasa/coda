import { faTrashAlt } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

const AdminAccessGrants: FunctionComponent = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AccessGrantListItem[]>([]);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      const response = await fetch(`/api/v1/db/accessGrants`);
      const data: AccessGrantListItem[] = await response.json();
      setRecords(data);
    })();
  }, [navigate]);

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Delete this access grant? It cannot be deleted if any media override still references it."
      )
    )
      return;
    const res = await fetch(`/api/v1/db/accessGrants/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: res.statusText }));
      alert(`Delete failed: ${body.message ?? res.statusText}`);
      return;
    }
    setRecords(records.filter((r) => r.id !== id));
  };

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin" className={adminCommon.backLink}>
          ← Admin
        </Link>
        <h1 className={adminCommon.pageTitle}>Access Grants</h1>
        <p className={adminCommon.introText}>
          Reusable lists of LaunchPad AUIDs. Attach a grant to a Media Override to restrict delivery
          of that override to only the AUIDs in the grant. Overrides with no grant attached remain
          public.
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Records</h2>
          <div className={adminCommon.details}>
            <Link to="/admin/accessGrantUpsert" className={adminCommon.createButton}>
              + Create Access Grant
            </Link>

            {records.length === 0 ? (
              <p className={adminCommon.emptyState}>No access grants defined.</p>
            ) : (
              <ul className={adminCommon.dateGroupRecords} style={{ marginTop: "12px" }}>
                {records.map((record) => (
                  <li key={record.id} className={adminCommon.recordItem}>
                    <Link
                      to={`/admin/accessGrantUpsert?id=${record.id}`}
                      className={adminCommon.recordLink}
                    >
                      {record.name}
                      <span className={adminCommon.recordMeta}>
                        {" "}
                        — {record.auidCount} AUID{record.auidCount === 1 ? "" : "s"}
                        {record.notes ? ` — ${record.notes}` : ""}
                      </span>
                    </Link>
                    <button
                      type="button"
                      className={adminCommon.deleteButton}
                      onClick={() => handleDelete(record.id)}
                      aria-label={`Delete ${record.name}`}
                    >
                      <FontAwesomeIcon icon={faTrashAlt} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default AdminAccessGrants;
