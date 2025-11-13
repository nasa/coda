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
      <h1>Photos Time Shifts</h1>
      <p>
        We need to identify the time offset that the still cameras were set to for some test events.
        These offsets can be a result of: The camera being set to a local timezone instead of UTC.
        The clock itself being set incorrectly, or having drifted over a long period of time without
        being reset Both (Test Event 50 is an example of "both") The "testEventID" is the test event
        ID in this wiki. The "timeoffset" is the (incorrect) set time of the cameras in hh:mm:ss
        from UTC.
      </p>
      <h3>
        <Link to={`/admin/photoTimeShiftUpsert`}>Create Record</Link>
      </h3>
      <h3>Records</h3>
      <ListRecords />
    </div>
  );
};

export default AdminIndex;

const ListRecords: FunctionComponent = () => {
  const [records, setRecords] = useState<PhotoRecord[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch("/api/v1/db/photoTimeShifts");
      const data: PhotoRecord[] = await response.json();
      setRecords(data);
    };
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    await fetch(`/api/v1/db/photoTimeShifts/${id}`, {
      method: "DELETE",
    });
    setRecords(records?.filter((record) => record.id !== id));
  };

  return (
    <div>
      <ul>
        {records?.map((record) => (
          <li key={record.id} className={styles.listItem}>
            <Link to={`/admin/photoTimeShiftUpsert?id=${record.id}`}>
              {record.date} - {record.source} - {record.timeOffset}
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
