import { faTrashAlt } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { FunctionComponent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

const AdminAssetOverrides: FunctionComponent = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AssetOverrideListItem[]>([]);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      const response = await fetch(`/api/v1/db/assetOverrides`);
      const data: AssetOverrideListItem[] = await response.json();
      setRecords(data);
    })();
  }, [navigate]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    await fetch(`/api/v1/db/assetOverrides/${id}`, { method: "DELETE" });
    setRecords(records.filter((record) => record.id !== id));
  };

  // Group records by mediaType
  const groupedRecords = useMemo(() => {
    const groups: Record<string, AssetOverrideListItem[]> = {};
    records.forEach((record) => {
      if (!groups[record.mediaType]) {
        groups[record.mediaType] = [];
      }
      groups[record.mediaType].push(record);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [records]);

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin" className={adminCommon.backLink}>
          ← Admin
        </Link>
        <h1 className={adminCommon.pageTitle}>Per-Asset Overrides</h1>
        <p className={adminCommon.introText}>
          Per-asset overrides keyed by NASA ID, scoped to a media type, source, and date range.
          Photo time overrides shift individual photo timestamps; video channel overrides assign
          individual videos to a CODA channel. Paste the JSON output of the generator scripts in
          [src/server/processing/artemis2/](src/server/processing/artemis2) into the form.
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Records</h2>
          <div className={adminCommon.details}>
            <Link to="/admin/assetOverrideUpsert" className={adminCommon.createButton}>
              + Create Override
            </Link>

            {records.length === 0 ? (
              <p className={adminCommon.emptyState}>No asset overrides found.</p>
            ) : (
              <div style={{ marginTop: "12px" }}>
                {groupedRecords.map(([mediaType, items]) => (
                  <div key={mediaType} className={adminCommon.dateGroup}>
                    <h3 className={adminCommon.dateGroupHeader}>{mediaType}</h3>
                    <ul className={adminCommon.dateGroupRecords}>
                      {items.map((record) => (
                        <li key={record.id} className={adminCommon.recordItem}>
                          <Link
                            to={`/admin/assetOverrideUpsert?id=${record.id}`}
                            className={adminCommon.recordLink}
                          >
                            {record.source} · {record.startDate} → {record.endDate}
                            <span className={adminCommon.recordMeta}>
                              {" "}
                              — {record.entryCount} entr{record.entryCount === 1 ? "y" : "ies"}
                              {record.notes ? ` · ${record.notes}` : ""}
                            </span>
                          </Link>
                          <button
                            type="button"
                            className={adminCommon.deleteButton}
                            onClick={() => handleDelete(record.id)}
                            aria-label={`Delete ${record.mediaType} ${record.source} ${record.startDate}`}
                          >
                            <FontAwesomeIcon icon={faTrashAlt} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default AdminAssetOverrides;
