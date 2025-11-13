import { faTrashAlt } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import styles from "./admin.module.css";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";

const AdminIndex: FunctionComponent = () => {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      //check permissions
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/"); //Redirect to homepage
      }
    })();
  }, []);

  return (
    <div>
      <Link to="/admin">Admin Home</Link>
      <h1>GPS</h1>
      <p>
        These records contain GPS tracks stored in GPX format. Such tracks are usually generated
        during field tests and are displayed in CODA in the GPS Position component for TEST_EVENTs
        with matching dates to the records inserted here.
      </p>
      <h3>
        <Link to={`/admin/gpsUpsert`}>Create Record</Link>
      </h3>
      <h3>Records</h3>
      <ListRecords />
    </div>
  );
};

export default AdminIndex;

const ListRecords: FunctionComponent = () => {
  const [records, setRecords] = useState<GPXTrackListRecord[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch("/api/v1/db/gps");
      const data: GPXTrackListRecord[] = await response.json();
      setRecords(data);
    };
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    await fetch(`/api/v1/db/gps/${id}`, {
      method: "DELETE",
    });
    setRecords(records?.filter((record) => record.id !== id));
  };

  return (
    <div>
      <ul>
        {records?.map((record) => (
          <li key={record.id} className={styles.listItem}>
            <Link to={`/admin/gpsUpsert?id=${record.id}`}>
              {record.date} - {record.name}
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
