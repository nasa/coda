import config from "../package.json";
import Link from "next/link";
import isNull from "lodash/isNull";
import { useRouter } from "next/router";
import { MutableRefObject, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ClockState, getApplicationUTC, getMissionTime, set } from "store/clock";
import { secondsToHHMMSS, shortdateFromZuluDate, timeFromZuluDate } from "utils/formatting";
import useInterval from "utils/useInterval";
import EVADropdown from "components/eva-dropdown";
import HeaderShare from "components/header-share";

import styles from "./header.module.css";
import { evaSelector, EVAsState } from "store/evas";

let missionTime = null as number;

/**
 * Renders the top bar of CODA
 */
function Header() {
  const router = useRouter();
  const dispatch = useDispatch();
  const store = useStore();
  const { clock, evas }: { clock: ClockState; evas: EVAsState } = useSelector((state) => state);

  const [userTimeValue, setUserTimeValue] = useState("");
  const [appDateTimeValue, setAppDateTimeValue] = useState(null);
  const [editingTime, setEditingTime] = useState(false);

  const [userDateValue, setUserDateValue] = useState("");
  const [editingDate, setEditingDate] = useState(false);

  const [pet, setPET] = useState("--:--:--");

  const eva = evaSelector(evas);

  let evaStartSec = null as number;
  const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d))$/; // matches valid hh:mm times
  if (!isNull(eva) && !isNull(eva.startTime.match(reHHMM))) {
    const [hh, mm] = eva.startTime.split(":");
    evaStartSec = 3600 * +hh + 60 * +mm;
  }

  const dateInput = useRef(null) as MutableRefObject<HTMLInputElement>;
  const timeInput = useRef(null) as MutableRefObject<HTMLInputElement>;

  useInterval(() => {
    const { clock } = store.getState();
    const newMissionTime = getMissionTime(clock);

    if (newMissionTime !== missionTime) {
      const utc = getApplicationUTC(clock);
      setAppDateTimeValue(utc);
      missionTime = newMissionTime;

      // set the PET if there's an EVA
      if (!isNull(evaStartSec)) {
        setPET(secondsToHHMMSS(missionTime - evaStartSec));
      }
    }
  }, 50);

  let renderTime = "00:00:00";
  let renderDate = "2019-08-21";
  if (appDateTimeValue) {
    const dt = new Date(appDateTimeValue);
    renderTime = timeFromZuluDate(dt);
    renderDate = shortdateFromZuluDate(dt);
  }

  /** Navigates to a new date or time */
  const handleDateTimeChange = () => {
    if (userDateValue !== "") {
      const [Y, M, D] = userDateValue.split("-");
      router.push(`/view?date=${Y}-${M}-${D}`);
      return;
    }

    const d = new Date(clock.applicationTime);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();

    let date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

    if (userTimeValue !== "") {
      const [hh, mm = "00", ss = "00"] = userTimeValue.split(":");
      date = new Date(Date.UTC(year, month, day, +hh, +mm, +ss));
    }

    dispatch(set(date.toUTCString()));
    setUserTimeValue("");
    setUserDateValue("");
    setEditingTime(false);
    setEditingDate(false);
  };

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
              <Link href="/">
                <a>
                  <img
                    src="/coda/images/logo_coda.png"
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </a>
              </Link>
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
                ref={dateInput}
                type="text"
                size={10}
                placeholder="yyyy-mm-dd"
                className={styles.dateTime}
                id="missionDate"
                name="missionDate"
                value={editingDate ? userDateValue : renderDate}
                style={{
                  width: "100px",
                  borderTopLeftRadius: "5px",
                  borderBottomLeftRadius: "5px",
                  marginRight: "1px",
                }}
                // match a yyyy-mm-dd or yyyy-m-d string
                // https://stackoverflow.com/a/22061879
                pattern="^\d{4}\-(0?[1-9]|1[012])\-(0?[1-9]|[12][0-9]|3[01])$"
                onFocus={() => {
                  setEditingDate(true);
                  setUserDateValue(renderDate);
                }}
                onBlur={() => {
                  if (editingDate) {
                    setEditingDate(false);
                  }
                }}
                onChange={(e) => setUserDateValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleDateTimeChange();
                  }
                }}
              />
            </div>
            <div>
              <input
                ref={timeInput}
                type="text"
                size={8}
                placeholder="hh:mm:ss"
                title="GMT"
                className={styles.dateTime}
                id="missionTime"
                name="missionTime"
                value={editingTime ? userTimeValue : renderTime}
                style={{
                  width: "70px",
                  borderTopRightRadius: "5px",
                  borderBottomRightRadius: "5px",
                  marginLeft: "1px",
                }}
                // allow HH:MM or HH:MM:SS
                pattern="^(?:(?:([01]?\d|2[0-3]):[0-5]\d))(?::[0-5]\d)?$"
                onFocus={() => {
                  setEditingTime(true);
                  setUserTimeValue(renderTime);
                }}
                onBlur={() => {
                  if (editingTime) {
                    setEditingTime(false);
                  }
                }}
                onChange={(e) => setUserTimeValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleDateTimeChange();
                  }
                }}
              />
            </div>
            <div style={{ marginLeft: "5px" }}>
              <button
                className={styles.littleHeaderButton}
                id="goButton"
                title="Jump to Date/Time"
                onClick={handleDateTimeChange}
              >
                Jump
              </button>
            </div>
          </div>
        </div>
        {!isNull(eva) && (
          <div className={styles.headerElementContainer}>
            <div>
              <div className={styles.pet} title="HH:MM">
                PET: <span style={{ color: "white" }}>{pet}</span>
              </div>
            </div>
          </div>
        )}
        <div className={styles.headerElementContainer}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            {!isNull(eva) && (
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
            Beta v{config.version}
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
