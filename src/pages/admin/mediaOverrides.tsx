import { faTrashAlt } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { FunctionComponent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styles from "./admin.module.css";

const AdminIndex: FunctionComponent = () => {
  return (
    <div>
      <Link to="/admin">Admin Home</Link>
      <h1>Media Overrides</h1>
      <p>
        These records are used by CODA to retrieve video from an alternate source by event type by
        date
      </p>
      <h3>
        <Link to={`/admin/mediaOverridesUpsert`}>Create Override</Link>
      </h3>
      <h3>Records</h3>
      <ListOverrides />
    </div>
  );
};

export default AdminIndex;

const ListOverrides: FunctionComponent = () => {
  const [records, setRecords] = useState<MediaOverrideList[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch("/api/v1/db/mediaOverrides");
      const data: WrappedResponse<MediaOverrideList[]> = await response.json();
      setRecords(data.data);
    };
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    await fetch(`/api/v1/db/mediaOverrides/${id}`, {
      method: "DELETE",
    });
    setRecords(records?.filter((record) => record.id !== id));
  };

  return (
    <div>
      <ul>
        {records?.map((record) => (
          <li key={record.id} className={styles.listItem}>
            <Link to={`/admin/mediaOverridesUpsert?id=${record.id}`}>
              {record.date} - {record.type}
            </Link>
            <FontAwesomeIcon
              onClick={() => {
                confirm("Are you sure you want to delete this record?") && handleDelete(record.id);
              }}
              icon={faTrashAlt}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};
