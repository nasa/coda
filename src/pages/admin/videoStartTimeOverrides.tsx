import { faTrashAlt } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
      <h1>Video Start Time Overrides</h1>
      <p>
        This page is accessed by the CODA application to manually set video start times in UTC. If
        you need to find the video start time from a{" "}
        <a href="https://coda.fit.nasa.gov/clocksync/index.html">QR code</a>, see this Python script
        from Ben Feist. If you need to use that time to set other videos from the same camera, see{" "}
        <a href="https://coda.fit.nasa.gov/clockcalc/clockcalc.html">clockcalc</a>. The "videoID" in
        this table is the "NASA ID" of a video in Imagery Online. The "time" is the actual UTC start
        time of the video.{" "}
      </p>
      <h3>
        <Link to={`/admin/videoStartTimeOverrideUpsert`}>Create Record</Link>
      </h3>
      <h3>Records</h3>
      <ListRecords />
    </div>
  );
};

export default AdminIndex;

const ListRecords: FunctionComponent = () => {
  const [records, setRecords] = useState<VideoRecord[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch("/api/v1/db/videoStartTimeOverrides");
      const data: WrappedResponse<VideoRecord[]> = await response.json();
      setRecords(data.data);
    };
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    await fetch(`/api/v1/db/videoStartTimeOverrides/${id}`, {
      method: "DELETE",
    });
    setRecords(records?.filter((record) => record.id !== id));
  };

  return (
    <div>
      <ul>
        {records?.map((record) => (
          <li key={record.id} className={styles.listItem}>
            <Link to={`/admin/videoStartTimeOverrideUpsert?id=${record.id}`}>
              {record.videoId} - {record.startTime}
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
