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
export const EditPhotoRecord: FunctionComponent = () => {
  const [date, setDate] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [timeOffset, setTimeOffset] = useState<string>("");
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
        const response = await fetch(`/api/v1/db/photoTimeShifts/${id}`);
        const data: WrappedResponse<PhotoRecord> = await response.json();
        setDate(data.data.date);
        setSource(data.data.source);
        setTimeOffset(data.data.timeOffset);
      };
      fetchData();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: PhotoUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      date,
      source,
      timeOffset,
    };
    // upsert
    await fetch(`/api/v1/db/photoTimeShifts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    navigate("/admin/photoTimeShifts");
  };

  return (
    <div>
      <h2>Edit Record</h2>
      <div>
        <Link to="/admin/photoTimeShifts">Back</Link>
      </div>
      <h3>{id ? "Edit" : "Create"}</h3>
      <form onSubmit={handleSubmit}>
        <FormItem label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
        <FormItem label="Source" value={source} onChange={(e) => setSource(e.target.value)} />
        <FormItem
          label="Time Offset"
          value={timeOffset}
          onChange={(e) => setTimeOffset(e.target.value)}
        />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};
