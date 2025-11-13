import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import styles from "./admin.module.css";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}
export const EditMediaOverridesRecord: FunctionComponent = () => {
  const [date, setDate] = useState<string>("");
  const [source, setSource] = useState<Source>("ARTEMIS");
  const [type, setType] = useState<MediaMedium>("video");
  const [url, setURL] = useState<string>("");
  const navigate = useNavigate();
  const query = useQuery();
  const id = query.get("id");

  useEffect(() => {
    (async () => {
      //check permissions
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/"); //Redirect to homepage
      }
    })();
  }, []);

  useEffect(() => {
    if (id) {
      const fetchData = async () => {
        const response = await fetch(`/api/v1/db/mediaOverrides/${id}`);
        const data: MediaOverride = await response.json();
        setDate(data.date);
        setSource(data.source);
        setType(data.type);
        setURL(data.url);
      };
      fetchData();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: MediaOverrideUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      date: date,
      source: source as Source,
      type: type as "video" | "photo" | "transcript" | "audio",
      url: url,
    };
    // upsert
    await fetch(`/api/v1/db/mediaOverrides`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    navigate("/admin/mediaOverrides");
  };

  return (
    <div>
      <h2>Edit Record</h2>
      <div>
        <Link to="/admin/mediaOverrides">Back</Link>
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
              setType(e.target.value as "video" | "photo" | "transcript" | "audio");
            }}
          >
            <option>video</option>
            <option>photo</option>
            <option>transcript</option>
            <option>audio</option>
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
