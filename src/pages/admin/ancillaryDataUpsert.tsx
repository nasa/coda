import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import styles from "./admin.module.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}
export const EditAncillaryDataRecord: FunctionComponent = () => {
  const [date, setDate] = useState<string>("");
  const [source, setSource] = useState<Source>("ARTEMIS");
  const [type, setType] = useState<"graphs">("graphs");
  const [url, setURL] = useState<string>("");
  const navigate = useNavigate();
  const query = useQuery();
  const id = query.get("id");

  useEffect(() => {
    if (id) {
      const fetchData = async () => {
        const response = await fetch(`/api/v1/db/ancillaryDataSources/${id}`);
        const data: WrappedResponse<AncillaryDataSource> = await response.json();
        setDate(data.data.date);
        setSource(data.data.source);
        setType(data.data.type);
        setURL(data.data.url);
      };
      fetchData();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: AncillaryDataUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      date: date,
      source: source as Source,
      type: type as "graphs",
      url: url,
    };
    // upsert
    await fetch(`/api/v1/db/ancillaryDataSources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    navigate("/admin/ancillaryData");
  };

  return (
    <div>
      <h2>Edit Record</h2>
      <div>
        <Link to="/admin/ancillaryData">Back</Link>
      </div>
      <h3>{id ? "Edit" : "Create"}</h3>
      <form onSubmit={handleSubmit}>
        <div className={styles.formItem}>
          <label>Date (yyyy-mm-dd):</label>
          <input type="text" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className={styles.formItem}>
          <label>Source:</label>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value as Source);
            }}
          >
            <option>ARTEMIS</option>
            <option>ISS</option>
            <option>NBL</option>
            <option>TEST_EVENTS</option>
          </select>
        </div>
        <div className={styles.formItem}>
          <label>Type:</label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as "graphs");
            }}
          >
            <option>graphs</option>
          </select>
        </div>
        <div className={styles.formItem}>
          <label>URL: </label>
          <textarea value={url} onChange={(e) => setURL(e.target.value)} />
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};
