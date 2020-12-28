import { useRouter } from "next/router";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { start } from "store/clock";
import styles from "./header.module.css";

/**
 * Renders the top bar of CODA
 */
function Header() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { selectedEVA, allEVAs, gEVADetails } = useSelector(
    (state) => state.evas
  );
  const [evaTime, setEvaTime] = useState("00:00:00");

  /**
   * Navigate to another EVA
   */
  const handleEVASelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    router.push(`/replay/${e.target.value}`);
  };

  return (
    <div className="headerContainer">
      <div style={{ display: "flex" }}>
        <div className="svgCODALogo"></div>
        <div
          className="headerTitle"
          style={{ float: "left", marginLeft: "10px" }}
        >
          CODA
        </div>
      </div>
      <div className={styles.floatLeft}>
        <select
          name="EVAsDropdown"
          id="EVAsDropdown"
          onChange={handleEVASelect}
          value={selectedEVA.toLowerCase()}
        >
          <option disabled>Choose EVA</option>
          {Object.keys(allEVAs).map((eva) => {
            const value = eva.replace(/ /g, "_").toLowerCase();
            return (
              <option key={value} value={value}>
                {eva}
              </option>
            );
          })}
        </select>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          marginLeft: "30px",
          minHeight: "4em",
        }}
      >
        <div style={{ display: "grid", flexWrap: "wrap" }}>
          <div style={{ flexGrow: 1, fontSize: "0.8em", color: "#9b9b9b" }}>
            EVA Name:{" "}
            <span style={{ color: "white" }} id="evaNameSpan">
              {gEVADetails.evaName || "EVA Name"}
            </span>
          </div>
          <div style={{ flexGrow: 1, fontSize: "0.8em", color: "#9b9b9b" }}>
            EVA Title:{" "}
            <span style={{ color: "white" }} id="evaTitleSpan">
              {gEVADetails.evaTitle || "EVA Title"}
            </span>
          </div>
          <div style={{ flexGrow: 1, fontSize: "0.8em", color: "#9b9b9b" }}>
            EV1:{" "}
            <span style={{ color: "white" }} id="ev1TitleSpan">
              EV1
            </span>
          </div>
          <div style={{ flexGrow: 1, fontSize: "0.8em", color: "#9b9b9b" }}>
            EV2:{" "}
            <span style={{ color: "white" }} id="ev2TitleSpan">
              EV2
            </span>
          </div>
        </div>
        <div
          className="MissionDateTimeWrapper"
          id="MissionDateTimeWrapper"
          style={{
            display: "flex",
            marginLeft: "30px",
            float: "left",
            width: "550px",
          }}
        >
          <div style={{ flexGrow: 1, fontSize: "0.8em", color: "#9b9b9b" }}>
            EVA Date/GMT:
          </div>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              size={10}
              className={styles.dateTime}
              id="missionDate"
              name="missionDate"
              value={gEVADetails.evaDate || "2019-08-21"}
              onChange={() => {}}
            />
          </div>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              size={8}
              className={styles.dateTime}
              id="missionTime"
              name="missionTime"
              value={evaTime}
              pattern="^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$"
              onChange={(e) => setEvaTime(e.target.value)}
            />
          </div>
          <div style={{ flex: 2 }}>
            <a
              className={styles.littleTopButton}
              id="goButton"
              title="Jump to Date/Time"
              onClick={(e) => {
                const [hh, mm, ss] = e.target.value.split(":");
                dispatch(start(new Date(hh, mm, ss).toISOString()));
              }}
            >
              GO
            </a>
            <button
              className={styles.littleTopButton}
              id="shareButton"
              title="Share"
              onClick={() => {}}
            >
              Share
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div className="svgNASALogo" style={{ float: "right" }} />
        <div
          style={{
            float: "right",
            textAlign: "right",
            fontSize: "0.8rem",
            marginRight: "10px",
          }}
        >
          Alpha v0.02
          <br />
          Contact:{" "}
          <a href="mailto:benjamin.f.feist@nasa.gov">
            benjamin.f.feist@nasa.gov
          </a>
        </div>
      </div>
    </div>
  );
}

export default Header;
