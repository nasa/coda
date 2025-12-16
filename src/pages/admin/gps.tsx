import { faTrashAlt } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { FunctionComponent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

const AdminGPS: FunctionComponent = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<GPXTrackListRecord[]>([]);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      const response = await fetch("/api/v1/db/gps");
      const data: GPXTrackListRecord[] = await response.json();
      setRecords(data);
    })();
  }, [navigate]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    await fetch(`/api/v1/db/gps/${id}`, { method: "DELETE" });
    setRecords(records.filter((record) => record.id !== id));
  };

  // Group records by date
  const groupedRecords = useMemo(() => {
    const groups: Record<string, GPXTrackListRecord[]> = {};
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
        <h1 className={adminCommon.pageTitle}>GPS Data</h1>
        <p className={adminCommon.introText}>
          Manage GPS tracks stored in GPX format. These tracks are typically generated during field
          tests and are displayed in the GPS Position component for TEST_EVENTs with matching dates.
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Records</h2>
          <div className={adminCommon.details}>
            <Link to="/admin/gpsUpsert" className={adminCommon.createButton}>
              + Create Record
            </Link>

            {records.length === 0 ? (
              <p className={adminCommon.emptyState}>No GPS records found.</p>
            ) : (
              <div style={{ marginTop: "12px" }}>
                {groupedRecords.map(([date, dateRecords]) => (
                  <div key={date} className={adminCommon.dateGroup}>
                    <h3 className={adminCommon.dateGroupHeader}>{date}</h3>
                    <ul className={adminCommon.dateGroupRecords}>
                      {dateRecords.map((record) => (
                        <li key={record.id} className={adminCommon.recordItem}>
                          <Link
                            to={`/admin/gpsUpsert?id=${record.id}`}
                            className={adminCommon.recordLink}
                          >
                            {record.name}
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

export default AdminGPS;
