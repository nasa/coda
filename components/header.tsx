import config from "../package.json";
import { useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ClockState, getApplicationUTC, getMissionTime, isSameDate, set } from "store/clock";
import { shortdateFromZuluDate, timeFromZuluDate } from "utils/formatting";
import useInterval from "utils/useInterval";
import EVADropdown from "components/eva-dropdown";
import HeaderShare from "components/header-share";

import styles from "./header.module.css";
import { evaSelector, EVAsState } from "store/evas";

let missionTime = null;

/**
 * Renders the top bar of CODA
 */
function Header() {
  const dispatch = useDispatch();
  const store = useStore();
  const { clock, evas }: { clock: ClockState; evas: EVAsState } = useSelector((state) => state);

  const [userValue, setUserValue] = useState("");
  const [appValue, setAppValue] = useState(null);
  const [editing, setEditing] = useState(false);

  const eva = evaSelector(evas);

  useInterval(() => {
    const { clock } = store.getState();
    const newMissionTime = getMissionTime(clock);

    if (newMissionTime !== missionTime) {
      const utc = getApplicationUTC(clock);
      setAppValue(utc);
      missionTime = newMissionTime;
    }
  }, 50);

  let renderTime = "00:00:00";
  let renderDate = "2019-08-21";
  if (appValue) {
    const dt = new Date(appValue);
    renderTime = timeFromZuluDate(dt);
    renderDate = shortdateFromZuluDate(dt);
  }

  return (
    <div className={styles.headerContainer}>
      <div className={styles.leftSection}>
        <div className={styles.headerElementContainer}>
          <div style={{ display: "flex" }}>
            <div className={styles.svgNASALogo} />
            <div
              className={styles.headerTitle}
              style={{ position: "relative", width: "100px", marginLeft: "10px" }}
            >
              <img
                src="/images/logo_coda.png"
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>
          </div>
        </div>
        <div className={styles.headerElementContainer}>
          <EVADropdown />
        </div>
        <div className={styles.headerElementContainer}>
          <div style={{ display: "flex", flexDirection: "row" }}>
            <div>
              <input
                type="text"
                size={10}
                className={styles.dateTime}
                id="missionDate"
                name="missionDate"
                value={renderDate}
                style={{
                  width: "88px",
                  borderTopLeftRadius: "5px",
                  borderBottomLeftRadius: "5px",
                  marginRight: "1px",
                }}
                onChange={() => {}}
              />
            </div>
            <div>
              <input
                type="text"
                size={8}
                className={styles.dateTime}
                id="missionTime"
                name="missionTime"
                value={editing ? userValue : renderTime}
                style={{
                  width: "70px",
                  borderTopRightRadius: "5px",
                  borderBottomRightRadius: "5px",
                  marginLeft: "1px",
                }}
                // allow HH:MM or HH:MM:SS
                pattern="^(?:(?:([01]?\d|2[0-3]):[0-5]\d))(?::[0-5]\d)?$"
                onFocus={() => {
                  setEditing(true);
                  setUserValue(`${renderTime}`);
                }}
                onBlur={() => {
                  if (editing) {
                    setEditing(false);
                  }
                }}
                onChange={(e) => setUserValue(e.target.value)}
              />
            </div>
            <div style={{ marginLeft: "5px" }}>
              <button
                className={styles.littleHeaderButton}
                id="goButton"
                title="Jump to Date/Time"
                onClick={(e) => {
                  const Y = new Date(clock.applicationTime).getUTCFullYear();

                  let dt: Date;
                  if (userValue === "") {
                    const [hh, mm, ss] = renderTime.split(":");
                    dt = new Date(+Y, +M - 1, +D, +hh, +mm, +ss);
                  } else {
                    const [hh, mm = "00", ss = "00"] = userValue.split(":");
                    dt = new Date(Date.UTC(+Y, +M - 1, +D, +hh, +mm, +ss));
                  }
                  dispatch(set(dt.toUTCString()));
                  setUserValue("");
                  setEditing(false);
                }}
              >
                Jump
              </button>
              {isSameDate(new Date(), new Date(clock.applicationTime)) && (
                <button
                  className={styles.littleHeaderButton}
                  title="Jump to now"
                  onClick={(e) => {
                    dispatch(set(new Date().toUTCString()));
                  }}
                >
                  Go Live
                </button>
              )}
            </div>
          </div>
        </div>
        <div className={styles.headerElementContainer}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            {eva && (
              <div>
                <div className={styles.crewItem}>
                  EV1:{" "}
                  <span style={{ color: "white" }} id="ev1TitleSpan">
                    {eva.crew?.EV1 || "unknown"}
                  </span>
                </div>
                <div className={styles.crewItem}>
                  EV2:{" "}
                  <span style={{ color: "white" }} id="ev2TitleSpan">
                    {eva.crew?.EV2 || "unknown"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.rightSection}>
        <div className={styles.headerElementContainer}>
          <div className={styles.version}>
            Alpha v{config.version}
            <br />
            Contact: <a href="mailto:benjamin.f.feist@nasa.gov">benjamin.f.feist@nasa.gov</a>
          </div>
        </div>
        <div className={styles.headerElementContainer} style={{ padding: "0" }}>
          <HeaderShare />
        </div>
      </div>
    </div>
  );
}

export default Header;
