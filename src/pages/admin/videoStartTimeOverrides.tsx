import { faTrashAlt } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";
import { prefixUrl } from "utils/basePath";

const AdminVideoStartTimeOverrides: FunctionComponent = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<VideoRecord[]>([]);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      const response = await fetch(prefixUrl("/api/v1/db/videoStartTimeOverrides"));
      const data: VideoRecord[] = await response.json();
      setRecords(data);
    })();
  }, [navigate]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    await fetch(prefixUrl(`/api/v1/db/videoStartTimeOverrides/${id}`), { method: "DELETE" });
    setRecords(records.filter((record) => record.id !== id));
  };

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin" className={adminCommon.backLink}>
          ← Admin
        </Link>
        <h1 className={adminCommon.pageTitle}>Video Start Time Overrides</h1>
        <p className={adminCommon.introText}>
          Manually set video start times in UTC. The "videoID" is the NASA ID from Imagery Online,
          and "time" is the actual UTC start time of the video.
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Helpful Tools</h2>
          <div className={adminCommon.details}>
            <p className={adminCommon.descriptionText}>
              To find the video start time from a QR code, use the{" "}
              <a
                href="https://coda.fit.nasa.gov/clocksync/index.html"
                className={adminCommon.externalLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                QR Code Scanner
              </a>
              . To calculate times for other videos from the same camera, use{" "}
              <a
                href="https://coda.fit.nasa.gov/clockcalc/clockcalc.html"
                className={adminCommon.externalLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                ClockCalc
              </a>
              .
            </p>
          </div>
        </section>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Records</h2>
          <div className={adminCommon.details}>
            <Link to="/admin/videoStartTimeOverrideUpsert" className={adminCommon.createButton}>
              + Create Record
            </Link>

            {records.length === 0 ? (
              <p className={adminCommon.emptyState}>No video start time overrides found.</p>
            ) : (
              <ul className={adminCommon.recordList} style={{ marginTop: "12px" }}>
                {records.map((record) => (
                  <li key={record.id} className={adminCommon.recordItem}>
                    <Link
                      to={`/admin/videoStartTimeOverrideUpsert?id=${record.id}`}
                      className={adminCommon.recordLink}
                    >
                      {record.videoId}
                      <span className={adminCommon.recordMeta}> — {record.startTime}</span>
                    </Link>
                    <button
                      type="button"
                      className={adminCommon.deleteButton}
                      onClick={() => handleDelete(record.id)}
                      aria-label={`Delete record for ${record.videoId}`}
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

export default AdminVideoStartTimeOverrides;
