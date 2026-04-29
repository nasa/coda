import { FunctionComponent, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { getCurrentUser } from "packages/getCurrentUser";
import { isSuperuser } from "utils/user";
import adminCommon from "./adminCommon.module.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export const EditAncillaryDataRecord: FunctionComponent = () => {
  const [date, setDate] = useState<string>("");
  const [source, setSource] = useState<Source>("ARTEMIS");
  const [type, setType] = useState<"graphs">("graphs");
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
        const response = await fetch(`/api/v1/db/ancillaryDataSources/${id}`);
        const data: AncillaryDataSource = await response.json();
        setDate(data.date);
        setSource(data.source);
        setType(data.type);
        setURL(data.url);
      }
    })();
  }, [navigate, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: AncillaryDataUpsertRequest = {
      id: id ? parseInt(id) : undefined,
      date: date,
      source: source as Source,
      type: type as "graphs",
      url: url,
    };
    await fetch(`/api/v1/db/ancillaryDataSources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    navigate("/admin/ancillaryData");
  };

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <Link to="/admin/ancillaryData" className={adminCommon.backLink}>
          ← Ancillary Data Sources
        </Link>
        <h1 className={adminCommon.pageTitle}>{id ? "Edit" : "Create"} Data Source</h1>
        <p className={adminCommon.introText}>
          {id
            ? "Modify the ancillary data source details below."
            : "Enter the ancillary data source details."}
        </p>

        <section className={adminCommon.section}>
          <h2 className={adminCommon.sectionHeading}>Source Details</h2>
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
                  <option value="ARTEMIS_TRAINING">ARTEMIS_TRAINING</option>
                  <option value="ISS">ISS</option>
                  <option value="NBL">NBL</option>
                  <option value="TEST_EVENTS">TEST_EVENTS</option>
                </select>
              </div>

              <div className={adminCommon.formGroup}>
                <label htmlFor="type" className={adminCommon.formLabel}>
                  Type
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as "graphs")}
                  className={adminCommon.formSelect}
                  required
                >
                  <option value="graphs">graphs</option>
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
                  placeholder="https://example.com/data-source"
                  required
                />
                <span className={adminCommon.formHint}>The URL endpoint for the data source</span>
              </div>

              <div className={adminCommon.formActions}>
                <button type="submit" className={adminCommon.buttonSubmit}>
                  {id ? "Update Source" : "Create Source"}
                </button>
                <Link to="/admin/ancillaryData" className={adminCommon.buttonCancel}>
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
