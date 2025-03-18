import { getCurrentUser } from "packages/getCurrentUser";
import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isSuperuser } from "utils/user";

const ServerSocketStatus: FunctionComponent = () => {
  const navigate = useNavigate();
  const [socketStatus, setSocketStatus] = useState<ServerSocketStatus>({ visitorsData: [] });

  useEffect(() => {
    (async () => {
      //check permissions
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/"); //Redirect to homepage
      }
      const res = await fetch(`/api/v1/socketStatus`);
      const socketStatus: ServerSocketStatus = await res.json();
      setSocketStatus(socketStatus);
    })();
  }, []);

  return (
    <div>
      <Link to="/admin">Admin Home</Link>
      <h1>Visitor Data from Server Socket Status</h1>
      <PrintUsers socketStatus={socketStatus} />
    </div>
  );
};

const PrintUsers: FunctionComponent<{
  socketStatus: ServerSocketStatus;
}> = ({ socketStatus }) => {
  let visitorsForPrint: { [uupic: string]: { connectedAt: string[] } } = {};
  socketStatus.visitorsData.forEach((visitorData) => {
    if (visitorData.user.uupic) {
      if (!visitorsForPrint[visitorData.user.uupic]) {
        visitorsForPrint[visitorData.user.uupic] = { connectedAt: [] };
      }
      visitorsForPrint[visitorData.user.uupic].connectedAt.push(
        new Date(visitorData.connectedAt).toUTCString()
      );
    }
  });

  // Filter duplicates, sort by surname, build a list
  const users = socketStatus.visitorsData.map((visitorData) => visitorData.user);
  const uniqueUsers = users.filter(
    (user, index) => users.findIndex((visitor) => visitor?.uupic === user?.uupic) === index
  );
  uniqueUsers.sort((a, b) => {
    const sa = a.surname || "";
    const sb = b.surname || "";
    return sa.localeCompare(sb);
  });

  return (
    <ul>
      {uniqueUsers.map((user) => {
        const count = visitorsForPrint[user.uupic].connectedAt.length;
        const displayName = user?.display_name || `${user?.surname}, ${user?.givenname}`;
        return (
          <li key={user.uupic}>
            ({count}) {displayName}
            {visitorsForPrint[user.uupic].connectedAt.map((connectedAt, index) => (
              <ul key={index}>
                <li>{connectedAt}</li>
              </ul>
            ))}
          </li>
        );
      })}
    </ul>
  );
};

export default ServerSocketStatus;
