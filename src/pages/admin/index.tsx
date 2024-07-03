import { FunctionComponent } from "react";
import { Link } from "react-router-dom";

const AdminIndex: FunctionComponent = () => {
  return (
    <div>
      <h1>Admin</h1>
      <p>
        <Link to="/admin/gps">GPS Data</Link>
        <br />
        <Link to="/admin/mediaOverrides">Media Overrides</Link>
      </p>
    </div>
  );
};

export default AdminIndex;
