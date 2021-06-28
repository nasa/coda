import Link from "next/link";
import isNil from "lodash/isNil";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { changeTime, isSameDate, PlayheadState } from "store/playhead";
import { SequencesEntityState, sequencesSelector } from "store/sequences";
import { getJulianDate, hhmmssFromSeconds, shortdateFromDateString } from "utils/formatting";
import EventDropdown from "components/dropdown";
import HeaderShare from "components/header-share";
import { RootState } from "store/index";
import { SequenceType } from "typings";

import styles from "./header.module.css";

/**
 * Renders the top bar of CODA
 */
function Header() {
  const dispatch = useDispatch();

  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);

  const [renderTime, setRenderTime] = useState("00:00:00");
  const [userTimeValue, setUserTimeValue] = useState("");
  const [editingTime, setEditingTime] = useState(false);

  const [renderDate, setRenderDate] = useState("2020-06-20");
  const [userDateValue, setUserDateValue] = useState("");
  const [editingDate, setEditingDate] = useState(false);

  const [julianDate, setJulianDate] = useState("2020/185:00:00");

  const [pet, setPET] = useState("--:--:--");

  const allSequences = sequencesSelector.selectAll(sequences);
  const seq = allSequences.find((seq) =>
    isSameDate(new Date(seq.startDate), new Date(playhead.date))
  );

  let seqStartSec = null as number;
  const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d))$/; // matches valid hh:mm times
  if (!isNil(seq) && !isNil(seq.startTime.match(reHHMM))) {
    const [hh, mm] = seq.startTime.split(":");
    seqStartSec = 3600 * +hh + 60 * +mm;
  }

  const dateInput = useRef(null) as MutableRefObject<HTMLInputElement>;
  const timeInput = useRef(null) as MutableRefObject<HTMLInputElement>;

  useEffect(() => {
    if (!isNil(seqStartSec)) {
      setPET(hhmmssFromSeconds(playhead.seconds - seqStartSec));
    }

    setRenderTime(hhmmssFromSeconds(playhead.seconds));
  }, [playhead.seconds]);

  useEffect(() => {
    const dt = new Date(playhead.date);
    setRenderDate(shortdateFromDateString(dt.toISOString()));
    setJulianDate(getJulianDate(dt));
  }, [playhead.date]);

  /** Navigates to a new date or time */
  const handleDateTimeChange = () => {
    if (userDateValue !== "") {
      const [Y, M, D] = userDateValue.split("-");
      window.location.assign(`${window.location.pathname}?date=${Y}-${M}-${D}`);
      return;
    }

    if (userTimeValue !== "") {
      const [hh, mm = "00", ss = "00"] = userTimeValue.split(":");
      const newTime = +ss + 60 * +mm + 3600 * +hh;
      dispatch(changeTime(newTime));
    }

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
            <div className={styles.headerTitle} style={{ position: "relative", width: "100px" }}>
              <Link href="/">
                <a>
                  <img
                    src="/images/logo_coda.png"
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
          <EventDropdown />
        </div>
        <div className={styles.headerElementContainer}>
          <div className={styles.dateTimeSection}>
            <div>
              <input
                ref={dateInput}
                type="text"
                size={10}
                placeholder="yyyy-mm-dd"
                className={styles.dateTimeField}
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
                pattern="^\d{4}-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|3[01])$"
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
                className={styles.dateTimeField}
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
            <div>
              <button
                className={styles.jumpButton}
                title="Jump to Date/Time"
                onClick={handleDateTimeChange}
              >
                Jump
              </button>
            </div>
          </div>
        </div>
        <div className={styles.headerElementContainer}>
          <div>
            <div className={styles.pet}>Julian Date</div>
          </div>
          <div>
            <div className={styles.pet}>{julianDate}</div>
          </div>
        </div>
        <div className={`${styles.headerElementContainer}`}>
          <HeaderShare />
        </div>
        {!isNil(seqStartSec) && seq.type === SequenceType.EVA && (
          <div className={styles.headerElementContainer}>
            <div>
              <div className={styles.pet} title="HH:MM">
                PET: <span style={{ color: "white" }}>{pet}</span>
              </div>
              <div className={styles.pet}>
                <button
                  className={styles.petButton}
                  title="Jump to EVA start time"
                  onClick={() => {
                    const [hh = 0, mm = 0, ss = 0] = seq.startTime.split(":");
                    const newTime = +ss + 60 * +mm + 3600 * +hh;
                    dispatch(changeTime(newTime));
                  }}
                >
                  EVA Start -&gt;
                </button>
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
            {!isNil(seq) && seq.type === SequenceType.EVA && (
              <div>
                <div className={styles.crewItem}>
                  EV1:{" "}
                  <span style={{ color: "white" }} id="ev1TitleSpan">
                    {seq.crew?.EV1 || "unknown"}
                  </span>
                </div>
                <div className={styles.crewItem}>
                  EV2:{" "}
                  <span style={{ color: "white" }} id="ev2TitleSpan">
                    {seq.crew?.EV2 || "unknown"}
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
            Beta Version
            <br />
            Contact: <a href="mailto:benjamin.f.feist@nasa.gov">benjamin.f.feist@nasa.gov</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;
