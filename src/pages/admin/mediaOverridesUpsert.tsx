import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export const EditMediaOverridesRecord: FunctionComponent = () => {
  const [date, setDate] = useState<string>("");
  const [source, setSource] = useState<Source>("ARTEMIS");
  const [type, setType] = useState<MediaMedium>("video");
  const [url, setURL] = useState<string>("");
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
        const response = await fetch(`/api/v1/db/mediaOverrides/${id}`);
        const data: MediaOverride = await response.json();
        setDate(data.date);
        setSource(data.source);
        setType(data.type);
        setURL(data.url);
      }
    })();
  }, [navigate, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: MediaOverrideUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      date: date,
      source: source as Source,
      type: type as "video" | "photo" | "transcript" | "audio",
      url: url,
    };
    await fetch(`/api/v1/db/mediaOverrides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    navigate("/admin/mediaOverrides");
  };

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin/mediaOverrides" className={adminCommon.backLink}>
          ← Media Overrides
        </Link>
        <h1 className={adminCommon.pageTitle}>{id ? "Edit" : "Create"} Media Override</h1>
        <p className={adminCommon.introText}>
          {id
            ? "Modify the media override details below."
            : "Enter the media override details to configure an alternate media source."}
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Override Details</h2>
          <div className={adminCommon.details}>
            <form onSubmit={handleSubmit} className={adminCommon.form}>
              <div className={adminCommon.formGroup}>
                <label htmlFor="date" className={adminCommon.formLabel}>
                  Date
                </label>
                <input
                  id="date"
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={adminCommon.formInput}
                  placeholder="yyyy-mm-dd"
                  required
                />
                <span className={adminCommon.formHint}>Format: yyyy-mm-dd (e.g., 2024-03-15)</span>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="source" className={adminCommon.formLabel}>
                  Source
                </label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as Source)}
                  className={adminCommon.formSelect}
                  required
                >
                  <option value="ARTEMIS">ARTEMIS</option>
                  <option value="ISS">ISS</option>
                  <option value="NBL">NBL</option>
                  <option value="TEST_EVENTS">TEST_EVENTS</option>
                </select>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="type" className={adminCommon.formLabel}>
                  Media Type
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as "video" | "photo" | "transcript" | "audio")
                  }
                  className={adminCommon.formSelect}
                  required
                >
                  <option value="video">video</option>
                  <option value="photo">photo</option>
                  <option value="transcript">transcript</option>
                  <option value="audio">audio</option>
                </select>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="url" className={adminCommon.formLabel}>
                  URL
                </label>
                <textarea
                  id="url"
                  value={url}
                  onChange={(e) => setURL(e.target.value)}
                  className={adminCommon.formTextarea}
                  placeholder="https://example.com/media-source"
                  required
                />
                <span className={adminCommon.formHint}>
                  The alternate URL endpoint for retrieving media
                </span>
              </div>

              <div className={adminCommon.formActions}>
                <button type="submit" className={adminCommon.buttonSubmit}>
                  {id ? "Update Override" : "Create Override"}
                </button>
                <Link to="/admin/mediaOverrides" className={adminCommon.buttonCancel}>
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
