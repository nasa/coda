import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";
import { prefixUrl } from "utils/basePath";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export const EditVideoRecord: FunctionComponent = () => {
  const [videoId, setVideoId] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const navigate = useNavigate();
  const query = useQuery();
  const id = query.get("id");

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
      if (id) {
        const response = await fetch(prefixUrl(`/api/v1/db/videoStartTimeOverrides/${id}`));
        const data: VideoRecord = await response.json();
        setVideoId(data.videoId);
        setStartTime(data.startTime);
      }
    })();
  }, [navigate, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: VideoUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      videoId,
      startTime,
    };
    await fetch(prefixUrl("/api/v1/db/videoStartTimeOverrides"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    navigate("/admin/videoStartTimeOverrides");
  };

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin/videoStartTimeOverrides" className={adminCommon.backLink}>
          ← Video Start Time Overrides
        </Link>
        <h1 className={adminCommon.pageTitle}>
          {id ? "Edit" : "Create"} Video Start Time Override
        </h1>
        <p className={adminCommon.introText}>
          {id
            ? "Modify the video start time override details below."
            : "Enter the video ID and its correct UTC start time."}
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Override Details</h2>
          <div className={adminCommon.details}>
            <form onSubmit={handleSubmit} className={adminCommon.form}>
              <div className={adminCommon.formGroup}>
                <label htmlFor="videoId" className={adminCommon.formLabel}>
                  Video ID
                </label>
                <input
                  id="videoId"
                  type="text"
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="NASA ID from Imagery Online"
                  required
                />
                <span className={adminCommon.formHint}>
                  The NASA ID of the video in Imagery Online
                </span>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="startTime" className={adminCommon.formLabel}>
                  Start Time (UTC)
                </label>
                <input
                  id="startTime"
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="yyyy-mm-ddTHH:MM:SSZ"
                  required
                />
                <span className={adminCommon.formHint}>
                  The actual UTC start time of the video (ISO 8601 format)
                </span>
              </div>

              <div className={adminCommon.formActions}>
                <button type="submit" className={adminCommon.buttonSubmit}>
                  {id ? "Update Override" : "Create Override"}
                </button>
                <Link to="/admin/videoStartTimeOverrides" className={adminCommon.buttonCancel}>
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
};
