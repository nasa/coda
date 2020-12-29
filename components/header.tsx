import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import {
  ClockState,
  getApplicationUTC,
  getMissionTime,
  historySelector,
  start,
} from "store/clock";
import { padZeros } from "utils/formatting";

import styles from "./header.module.css";

/**
 * Renders the top bar of CODA
 */
function Header() {
  const router = useRouter();
  const dispatch = useDispatch();
  const store = useStore();
  const {
    evas: { EVAs, selectedEVA },
  } = useSelector((state) => state);

  const [userValue, setUserValue] = useState("");
  const [appValue, setAppValue] = useState("00:00:00");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      const { clock } = store.getState();
      let missionHHMMSS = "00:00:00";
      const utc = getApplicationUTC(historySelector(clock));
      if (utc) {
        const hh = padZeros(utc.getHours(), 2);
        const mm = padZeros(utc.getMinutes(), 2);
        const ss = padZeros(utc.getSeconds(), 2);
        missionHHMMSS = `${hh}:${mm}:${ss}`;
      }
      setAppValue(missionHHMMSS);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
          {Object.keys(EVAs).map((eva) => {
            return (
              <option key={eva} value={eva}>
                {EVAs[eva].displayTitle}
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
              {EVAs[selectedEVA].name || "EVA Name"}
            </span>
          </div>
          <div style={{ flexGrow: 1, fontSize: "0.8em", color: "#9b9b9b" }}>
            EVA Title:{" "}
            <span style={{ color: "white" }} id="evaTitleSpan">
              {EVAs[selectedEVA].displayTitle || "EVA Title"}
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
              value={EVAs[selectedEVA].startDate || "2019-08-21"}
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
              value={editing ? userValue : appValue}
              // allow HH:MM or HH:MM:SS
              pattern="^(?:(?:([01]?\d|2[0-3]):[0-5]\d))(?::[0-5]\d)?$"
              onFocus={() => {
                setEditing(true);
                setUserValue(`${userValue || appValue}`);
              }}
              onBlur={() => {
                setUserValue("");
                setEditing(false);
              }}
              onChange={(e) => setUserValue(e.target.value)}
            />
          </div>
          <div style={{ flex: 2 }}>
            <button
              className={styles.littleTopButton}
              id="goButton"
              title="Jump to Date/Time"
              onClick={(e) => {
                const [Y, M, D] = EVAs[selectedEVA].startDate.split("/");
                let dt: Date;
                if (userValue === "") {
                  dt = new Date(+Y, +M - 1, +D);
                } else {
                  const [hh, mm = "00", ss = "00"] = userValue.split(":");
                  dt = new Date(+Y, +M - 1, +D, +hh, +mm, +ss);
                }
                dispatch(start(dt.toISOString()));
                setUserValue("");
                setEditing(false);
              }}
            >
              GO
            </button>
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
