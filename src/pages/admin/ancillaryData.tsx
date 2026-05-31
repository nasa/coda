import { faTrashAlt } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { FunctionComponent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";
import { prefixUrl } from "utils/basePath";

const AdminAncillaryData: FunctionComponent = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AncillaryDataSourceList[]>([]);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      const response = await fetch(prefixUrl("/api/v1/db/ancillaryDataSources"));
      const data: AncillaryDataSourceList[] = await response.json();
      setRecords(data);
    })();
  }, [navigate]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    await fetch(prefixUrl(`/api/v1/db/ancillaryDataSources/${id}`), { method: "DELETE" });
    setRecords(records.filter((record) => record.id !== id));
  };

  // Group records by date
  const groupedRecords = useMemo(() => {
    const groups: Record<string, AncillaryDataSourceList[]> = {};
    records.forEach((record) => {
      if (!groups[record.date]) {
        groups[record.date] = [];
      }
      groups[record.date].push(record);
    });
    // Sort dates descending
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [records]);

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin" className={adminCommon.backLink}>
          ← Admin
        </Link>
        <h1 className={adminCommon.pageTitle}>Ancillary Data Sources</h1>
        <p className={adminCommon.introText}>
          Manage external data source URLs used by CODA for retrieving additional data, primarily
          for graphing and visualization purposes.
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Records</h2>
          <div className={adminCommon.details}>
            <Link to="/admin/ancillaryDataUpsert" className={adminCommon.createButton}>
              + Create Data Source
            </Link>

            {records.length === 0 ? (
              <p className={adminCommon.emptyState}>No ancillary data sources found.</p>
            ) : (
              <div style={{ marginTop: "12px" }}>
                {groupedRecords.map(([date, dateRecords]) => (
                  <div key={date} className={adminCommon.dateGroup}>
                    <h3 className={adminCommon.dateGroupHeader}>{date}</h3>
                    <ul className={adminCommon.dateGroupRecords}>
                      {dateRecords.map((record) => (
                        <li key={record.id} className={adminCommon.recordItem}>
                          <Link
                            to={`/admin/ancillaryDataUpsert?id=${record.id}`}
                            className={adminCommon.recordLink}
                          >
                            {record.source}
                            <span className={adminCommon.recordMeta}> — {record.type}</span>
                          </Link>
                          <button
                            type="button"
                            className={adminCommon.deleteButton}
                            onClick={() => handleDelete(record.id)}
                            aria-label={`Delete ${record.source} ${record.type}`}
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

export default AdminAncillaryData;
