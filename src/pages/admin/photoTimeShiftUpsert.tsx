import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";
import { prefixUrl } from "utils/basePath";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export const EditPhotoRecord: FunctionComponent = () => {
  const [date, setDate] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [timeOffset, setTimeOffset] = useState<string>("");
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
        const response = await fetch(prefixUrl(`/api/v1/db/photoTimeShifts/${id}`));
        const data: PhotoRecord = await response.json();
        setDate(data.date);
        setSource(data.source);
        setTimeOffset(data.timeOffset);
      }
    })();
  }, [navigate, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: PhotoUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      date,
      source,
      timeOffset,
    };
    await fetch(prefixUrl(`/api/v1/db/photoTimeShifts`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    navigate("/admin/photoTimeShifts");
  };

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin/photoTimeShifts" className={adminCommon.backLink}>
          ← Photo Time Shifts
        </Link>
        <h1 className={adminCommon.pageTitle}>{id ? "Edit" : "Create"} Photo Time Shift</h1>
        <p className={adminCommon.introText}>
          {id
            ? "Modify the photo time shift details below."
            : "Enter the time offset correction for still camera timestamps."}
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Time Shift Details</h2>
          <div className={adminCommon.details}>
            <form onSubmit={handleSubmit} className={adminCommon.form}>
              <div className={adminCommon.formGroup}>
                <label htmlFor="date" className={adminCommon.formLabel}>
                  Date
                </label>
                <input
                  id="date"
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="yyyy-mm-dd"
                  required
                />
                <span className={adminCommon.formHint}>Format: yyyy-mm-dd (e.g., 2024-03-15)</span>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="source" className={adminCommon.formLabel}>
                  Source
                </label>
                <input
                  id="source"
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="Camera or source identifier"
                  required
                />
                <span className={adminCommon.formHint}>
                  Identifier for the camera or photo source
                </span>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="timeOffset" className={adminCommon.formLabel}>
                  Time Offset
                </label>
                <input
                  id="timeOffset"
                  type="text"
                  value={timeOffset}
                  onChange={(e) => setTimeOffset(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="±hh:mm:ss"
                  required
                />
                <span className={adminCommon.formHint}>
                  The time offset from UTC in hh:mm:ss format (e.g., -05:00:00)
                </span>
              </div>

              <div className={adminCommon.formActions}>
                <button type="submit" className={adminCommon.buttonSubmit}>
                  {id ? "Update Time Shift" : "Create Time Shift"}
                </button>
                <Link to="/admin/photoTimeShifts" className={adminCommon.buttonCancel}>
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
