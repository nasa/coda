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
import useInterval from "utils/useInterval";

import styles from "./header.module.css";

let missionTime = null;

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
  const [appValue, setAppValue] = useState(null);
  const [editing, setEditing] = useState(false);
  useInterval(() => {
    const { clock } = store.getState();
    const newMissionTime = getMissionTime(historySelector(clock));

    if (newMissionTime !== missionTime) {
      const utc = getApplicationUTC(historySelector(clock));
      setAppValue(utc);
      missionTime = newMissionTime;
    }
  }, 50);

  /**
   * Navigate to another EVA
   */
  const handleEVASelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    router.push(`/replay/${e.target.value}`);
  };

  let renderTime = "00:00:00";
  if (appValue) {
    const dt = new Date(appValue);
    const hh = padZeros(dt.getHours(), 2);
    const mm = padZeros(dt.getMinutes(), 2);
    const ss = padZeros(dt.getSeconds(), 2);
    renderTime = `${hh}:${mm}:${ss}`;
  }

  return (
    <div className={styles.headerContainer}>
      <div style={{ display: "flex" }}>
        <div className={styles.svgCODALogo}></div>
        <div
          className={styles.headerTitle}
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
                {EVAs[eva].name}
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
          className={styles.MissionDateTimeWrapper}
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
              value={editing ? userValue : renderTime}
              // allow HH:MM or HH:MM:SS
              pattern="^(?:(?:([01]?\d|2[0-3]):[0-5]\d))(?::[0-5]\d)?$"
              onFocus={() => {
                setEditing(true);
                setUserValue(`${renderTime}`);
              }}
              onBlur={() => {
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
                let hh, mm, ss;
                let dt: Date;
                if (userValue === "") {
                  const [hh, mm, ss] = renderTime.split(":");
                  dt = new Date(+Y, +M - 1, +D, +hh, +mm, +ss);
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
        <div className={styles.svgNASALogo} style={{ float: "right" }} />
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
