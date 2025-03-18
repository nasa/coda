import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import styles from "./admin.module.css";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";

const FormItem: FunctionComponent<{
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, value, onChange }) => (
  <div className={styles.formItem}>
    <label>{label}</label>
    <input type="text" value={value} onChange={onChange} />
  </div>
);

function useQuery() {
  return new URLSearchParams(useLocation().search);
}
export const EditVideoRecord: FunctionComponent = () => {
  const [videoId, setVideoId] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
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
        const response = await fetch(`/api/v1/db/videoStartTimeOverrides/${id}`);
        const data: WrappedResponse<VideoRecord> = await response.json();
        setVideoId(data.data.videoId);
        setStartTime(data.data.startTime);
      };
      fetchData();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: VideoUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      videoId,
      startTime,
    };
    // upsert
    await fetch("/api/v1/db/videoStartTimeOverrides", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    navigate("/admin/videoStartTimeOverrides");
  };

  return (
    <div>
      <h2>Edit Record</h2>
      <div>
        <Link to="/admin/videoStartTimeOverrides">Back</Link>
      </div>
      <h3>{id ? "Edit" : "Create"}</h3>
      <form onSubmit={handleSubmit}>
        <FormItem label="Video ID" value={videoId} onChange={(e) => setVideoId(e.target.value)} />
        <FormItem
          label="Start Time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};
