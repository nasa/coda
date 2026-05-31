import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";
import { prefixUrl } from "utils/basePath";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export const EditGPSRecord: FunctionComponent = () => {
  const [date, setDate] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [gpxData, setGpxData] = useState<string>("");
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
        const response = await fetch(prefixUrl(`/api/v1/db/gps/${id}`));
        const data: GPXTrackRecord = await response.json();
        setDate(data.date);
        setName(data.name);
        setGpxData(data.gpxData);
      }
    })();
  }, [navigate, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: GPSUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      date: date,
      name: name,
      gpxData: gpxData,
    };
    await fetch(prefixUrl(`/api/v1/db/gps`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    navigate("/admin/gps");
  };

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin/gps" className={adminCommon.backLink}>
          ← GPS Data
        </Link>
        <h1 className={adminCommon.pageTitle}>{id ? "Edit" : "Create"} GPS Record</h1>
        <p className={adminCommon.introText}>
          {id
            ? "Modify the GPS track record details below."
            : "Enter the GPS track record details."}
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Record Details</h2>
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
                <label htmlFor="name" className={adminCommon.formLabel}>
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="EV1, EV2, Cart"
                  required
                />
                <span className={adminCommon.formHint}>
                  Identifier for the GPS track (e.g., EV1, EV2, Cart)
                </span>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="gpxData" className={adminCommon.formLabel}>
                  GPX Data
                </label>
                <textarea
                  id="gpxData"
                  value={gpxData}
                  onChange={(e) => setGpxData(e.target.value)}
                  className={adminCommon.formTextarea}
                  placeholder="Paste GPX XML data here..."
                  required
                />
                <span className={adminCommon.formHint}>GPX format XML data for the track</span>
              </div>

              <div className={adminCommon.formActions}>
                <button type="submit" className={adminCommon.buttonSubmit}>
                  {id ? "Update Record" : "Create Record"}
                </button>
                <Link to="/admin/gps" className={adminCommon.buttonCancel}>
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
