import { getCurrentUser } from "packages/getCurrentUser";
import { FunctionComponent, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
      <h1>Admin</h1>
      <p>
        <Link to="/admin/gps">GPS Data</Link>
        <br />
        <Link to="/admin/mediaOverrides">Media Overrides</Link>
        <br />
        <Link to="/admin/ancillaryData">Ancillary Data Sources</Link>
        <br />
        <Link to="/admin/videoStartTimeOverrides">Video Start Time Overrides</Link>
        <br />
        <Link to="/admin/photoTimeShifts">Photo Time Shifts</Link>
      </p>
      <p>
        <Link to="/admin/socketStatus">Server Socket Status</Link>
      </p>
    </div>
  );
};

export default AdminIndex;
