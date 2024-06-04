import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import styles from "./admin.module.css";

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
    if (id) {
      const fetchData = async () => {
        const response = await fetch(`/api/v1/db/gps/${id}`);
        const data: WrappedResponse<GPXTrackRecord> = await response.json();
        setDate(data.data.date);
        setName(data.data.name);
        setGpxData(data.data.gpxData);
      };
      fetchData();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: GpsUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      date: date,
      name: name,
      gpxData: gpxData,
    };
    // upsert
    await fetch(`/api/v1/db/gps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    navigate("/admin/gps");
  };

  return (
    <div>
      <h2>Edit Record</h2>
      <div>
        <Link to="/admin/gps">Back</Link>
      </div>
      <h3>{id ? "Edit" : "Create"}</h3>
      <form onSubmit={handleSubmit}>
        <div className={styles.formItem}>
          <label>Date (yyyy-mm-dd):</label>
          <input type="text" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className={styles.formItem}>
          <label>Name (EV1, EV2, Cart):</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={styles.formItem}>
          <label>GPX Data (XML): </label>
          <textarea value={gpxData} onChange={(e) => setGpxData(e.target.value)} />
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};
