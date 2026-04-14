import { faTrashAlt } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { FunctionComponent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

const AdminPhotoTimeShifts: FunctionComponent = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<PhotoRecord[]>([]);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      const response = await fetch("/api/v1/db/photoTimeShifts");
      const data: PhotoRecord[] = await response.json();
      setRecords(data);
    })();
  }, [navigate]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    await fetch(`/api/v1/db/photoTimeShifts/${id}`, { method: "DELETE" });
    setRecords(records.filter((record) => record.id !== id));
  };

  // Group records by date
  const groupedRecords = useMemo(() => {
    const groups: Record<string, PhotoRecord[]> = {};
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
        <h1 className={adminCommon.pageTitle}>Photo Time Shifts</h1>
        <p className={adminCommon.introText}>
          Configure time offset corrections for still camera timestamps. These offsets account for
          cameras set to local timezone instead of UTC, incorrect clock settings, or clock drift
          over time.
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Records</h2>
          <div className={adminCommon.details}>
            <Link to="/admin/photoTimeShiftUpsert" className={adminCommon.createButton}>
              + Create Record
            </Link>

            {records.length === 0 ? (
              <p className={adminCommon.emptyState}>No photo time shift records found.</p>
            ) : (
              <div style={{ marginTop: "12px" }}>
                {groupedRecords.map(([date, dateRecords]) => (
                  <div key={date} className={adminCommon.dateGroup}>
                    <h3 className={adminCommon.dateGroupHeader}>{date}</h3>
                    <ul className={adminCommon.dateGroupRecords}>
                      {dateRecords.map((record) => (
                        <li key={record.id} className={adminCommon.recordItem}>
                          <Link
                            to={`/admin/photoTimeShiftUpsert?id=${record.id}`}
                            className={adminCommon.recordLink}
                          >
                            {record.source}
                            <span className={adminCommon.recordMeta}>
                              {record.nasaIdPrefix !== "*" && ` (${record.nasaIdPrefix})`} —{" "}
                              {record.timeOffset}
                            </span>
                          </Link>
                          <button
                            type="button"
                            className={adminCommon.deleteButton}
                            onClick={() => handleDelete(record.id)}
                            aria-label={`Delete ${record.source}`}
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

export default AdminPhotoTimeShifts;
