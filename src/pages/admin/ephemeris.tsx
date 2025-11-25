import { FunctionComponent, useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";

const AdminEphemeris: FunctionComponent = () => {
  const navigate = useNavigate();
  const progressTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [stats, setStats] = useState<{
    count: number;
    latestEpoch: string | null;
    yearCounts: Array<{ year: number; count: number }>;
  }>({
    count: 0,
    latestEpoch: null,
    yearCounts: [],
  });
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seedProgress, setSeedProgress] = useState<string[]>([]);

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
    fetchStats();
  }, []);

  useEffect(() => {
    if (progressTextareaRef.current) {
      progressTextareaRef.current.scrollTop = progressTextareaRef.current.scrollHeight;
    }
  }, [seedProgress]);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/v1/db/ephemeris/stats");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    setSeedProgress(["Initializing..."]);
    try {
      const response = await fetch("/api/v1/db/ephemeris/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        setSeedResult(`Error: ${data.message}`);
        setSeedProgress([]);
        return;
      }

      // Check if response is streaming (text/event-stream or ndjson)
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/event-stream") || contentType?.includes("ndjson")) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const progressData = JSON.parse(line);
                  if (progressData.progress) {
                    setSeedProgress((prev) => [...prev, progressData.progress]);
                  }
                  if (progressData.complete) {
                    setSeedResult(`${progressData.message}`);
                  }
                } catch (e) {
                  // Skip invalid JSON lines
                }
              }
            }
          }
        }
        fetchStats(); // Refresh stats
      } else {
        // Fallback to regular JSON response
        const data = await response.json();
        setSeedResult(`${data.message}`);
        fetchStats(); // Refresh stats
      }
    } catch (e) {
      setSeedResult(`Error: ${e}`);
      setSeedProgress([]);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div>
      <Link to="/admin">Admin Home</Link>
      <h1>Ephemeris (ISS TLE)</h1>
      <p>
        These records contain Two-Line Element (TLE) data for the ISS. TLEs are automatically seeded
        from historical data and can be used for orbit calculations and position tracking.
      </p>

      <h3>Database Statistics</h3>
      <div>
        <p>
          <strong>Total Records:</strong> {stats.count}
        </p>
        <p>
          <strong>Latest Epoch:</strong>{" "}
          {stats.latestEpoch ? new Date(stats.latestEpoch).toISOString() : "N/A"}
        </p>
        {stats.yearCounts?.length > 0 && (
          <div>
            <p>
              <strong>Records by Year:</strong>
            </p>
            <ul
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(120px, 200px))",
                gap: "8px",
                listStyle: "none",
                padding: 0,
              }}
            >
              {stats.yearCounts.map((yc) => (
                <li key={yc.year}>
                  {yc.year}: {yc.count.toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <h3>Seed Database</h3>
      <p>
        <button onClick={handleSeed} disabled={seeding}>
          {seeding ? "Seeding..." : "Seed Missing Data"}
        </button>
      </p>
      {seedProgress.length > 0 && (
        <textarea
          ref={progressTextareaRef}
          readOnly
          value={seedProgress.join("\n")}
          style={{
            width: "calc(100% - 20px)",
            maxWidth: "800px",
            height: "200px",
            fontFamily: "monospace",
            fontSize: "12px",
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            backgroundColor: "#f5f5f5",
            resize: "vertical",
            overflow: "auto",
          }}
        />
      )}
      {seedResult && <p>{seedResult}</p>}
    </div>
  );
};

export default AdminEphemeris;
