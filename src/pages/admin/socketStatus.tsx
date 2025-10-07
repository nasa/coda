import {
  faArrowRotateRight,
  faCaretDown,
  faCaretRight,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import uniq from "lodash/uniq";
import { getCurrentUser } from "packages/getCurrentUser";
import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { isSuperuser } from "utils/user";

const ServerSocketStatus: FunctionComponent = () => {
  const navigate = useNavigate();
  const [serverSocketStatus, setServerSocketStatus] = useState<ServerSocketStatus>({
    visitorsData: [],
  });

  useEffect(() => {
    (async () => {
      //check permissions
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/"); //Redirect to homepage
      }
      const res = await fetch(`/api/v1/socketStatus`);
      const socketStatus: ServerSocketStatus = await res.json();
      setServerSocketStatus(socketStatus);
    })();
  }, []);

  return (
    <div>
      <Link to="/admin">Admin Home</Link>
      <div style={{ display: "flex", alignItems: "center", columnGap: "10px" }}>
        <h2>Visitor Connections</h2>
        <FontAwesomeIcon
          icon={faArrowRotateRight}
          onClick={() => {
            (async () => {
              const res = await fetch(`/api/v1/socketStatus`);
              setServerSocketStatus(await res.json());
            })();
          }}
          style={{ cursor: "pointer" }}
        />
      </div>
      {serverSocketStatus?.visitorsData?.length} total visitors connected
      {!serverSocketStatus?.visitorsData?.length ? (
        <p>No visitors connected.</p>
      ) : (
        <PrintUsers visitorsData={serverSocketStatus.visitorsData} />
      )}
    </div>
  );
};

const PrintUsers: FunctionComponent<{
  visitorsData: VisitorData[];
}> = ({ visitorsData }) => {
  // Get unique sources and sort them
  const sources = uniq(visitorsData.map((visitor) => visitor.source)).sort();

  // Track expanded - initialize all to expanded
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [expandedDatesViewing, setExpandedDatesViewing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Initialize state when visitorData changes
    const initialSourceState: Record<string, boolean> = {};
    const initialDateState: Record<string, boolean> = {};
    const uniqSources = uniq(visitorsData.map((visitor) => visitor.source));
    uniqSources.forEach((source) => {
      initialSourceState[source] = true; // Set all sources to expanded by default
      const uniqDatesViewingForSource = uniq(
        visitorsData.filter((v) => v.source === source).map((visitor) => visitor.dateViewing)
      );
      uniqDatesViewingForSource.forEach((date) => {
        initialDateState[`${source}-${date}`] = true; // Set all dates viewing to expanded by default
      });
    });
    setExpandedSources(initialSourceState);
    setExpandedDatesViewing(initialDateState);
  }, [visitorsData]);

  const toggleSource = (source: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [source]: !prev[source],
    }));
  };
  const toggleDateViewing = (dateAndSource: string) => {
    setExpandedDatesViewing((prev) => ({
      ...prev,
      [dateAndSource]: !prev[dateAndSource],
    }));
  };

  return (
    <div>
      {sources.map((source) => {
        // Filter data for this source
        const sourceVisitorData = visitorsData.filter((visitor) => visitor.source === source);
        // Get unique dates for this source
        const sourceDates = uniq(sourceVisitorData.map((visitor) => visitor.dateViewing)).sort(
          (a, b) => (a < b ? 1 : -1)
        );

        return (
          <div key={source}>
            <div
              onClick={() => toggleSource(source)}
              style={{
                cursor: "pointer",
                marginTop: "10px",
                userSelect: "none",
              }}
            >
              <h3>
                {expandedSources[source] ? (
                  <FontAwesomeIcon icon={faCaretDown} size="lg" style={{ paddingRight: 5 }} />
                ) : (
                  <FontAwesomeIcon icon={faCaretRight} size="lg" style={{ paddingRight: 5 }} />
                )}
                Source: {source || "Unknown"} ({sourceVisitorData.length}{" "}
                <FontAwesomeIcon icon={faEye} />)
              </h3>
            </div>

            {expandedSources[source] && (
              <div style={{ paddingLeft: "20px" }}>
                {sourceDates.map((date) => {
                  // Filter data for this date within this source
                  const dateVisitorData = sourceVisitorData.filter(
                    (visitor) => visitor.dateViewing === date
                  );

                  // Get sorted unique users in this date
                  const launchpadUsers = dateVisitorData.map((visitor) => visitor.user);
                  const uniqueUsers = launchpadUsers.filter(
                    (user, index) =>
                      launchpadUsers.findIndex((visitor) => visitor?.uupic === user?.uupic) ===
                      index
                  );
                  uniqueUsers.sort((a, b) => {
                    const sa = a?.surname || "";
                    const sb = b?.surname || "";
                    return sa.localeCompare(sb);
                  });

                  return (
                    <div key={`${source}-${date}`}>
                      <div
                        onClick={() => toggleDateViewing(`${source}-${date}`)}
                        style={{
                          cursor: "pointer",
                          marginTop: "10px",
                          userSelect: "none",
                        }}
                      >
                        <h3>
                          {expandedDatesViewing[`${source}-${date}`] ? (
                            <FontAwesomeIcon
                              icon={faCaretDown}
                              size="lg"
                              style={{ paddingRight: 5 }}
                            />
                          ) : (
                            <FontAwesomeIcon
                              icon={faCaretRight}
                              size="lg"
                              style={{ paddingRight: 5 }}
                            />
                          )}
                          {date}: ({dateVisitorData.length} <FontAwesomeIcon icon={faEye} />)
                        </h3>
                      </div>

                      {expandedDatesViewing[`${source}-${date}`] && (
                        <ul>
                          {uniqueUsers.map((user) => {
                            const allVisitorRecords = dateVisitorData.filter(
                              (visitor) => visitor.user?.uupic === user?.uupic
                            );
                            const displayName =
                              user?.display_name || `${user?.surname}, ${user?.givenname}`;
                            return (
                              <li key={`${source}-${date}-${user?.uupic}`}>
                                ({allVisitorRecords.length}) {displayName}
                                {allVisitorRecords.map((record, index) => {
                                  return (
                                    <div key={`${record.socketId}-${index}`}>
                                      {index > 0 ? <br /> : ""}
                                      <div
                                        style={{ paddingLeft: "20px" }}
                                        key={`${record.socketId}-${index}`}
                                      >
                                        Version: {record?.appVersion?.version} -{" "}
                                        {record?.appVersion?.gitCommit} <br />
                                        Connected At: {new Date(record?.connectedAt).toUTCString()}
                                      </div>
                                    </div>
                                  );
                                })}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ServerSocketStatus;
