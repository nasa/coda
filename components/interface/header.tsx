import { useDispatch, useSelector } from "react-redux";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faCalendarAlt, faClock, faQuestionCircle } from "@fortawesome/free-regular-svg-icons";
import { faFloppyDisk } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Calendar from "components/interface/calendar";
import { ModalDropdown } from "components/interface/dropdown-modal";
import LayoutPicker from "components/framework/layout-picker";
import PresetPicker from "components/framework/preset-picker";
import { RootState } from "store/index";
import styles from "./header.module.css";
import layoutStyles from "/components/framework/frames.module.css";
import { hhmmssFromSeconds, padZeros } from "utils/formatting";
import { Collection, Source } from "utils/enums";
import StatusArea from "./status";
import EventDropdown from "components/interface/dropdown-event";
import SharePanel from "components/interface/share";
import { changeSource } from "store/framework";
import { clearVideos } from "store/videos";
import { clearPhotos } from "store/photos";
import { clearEphemera } from "store/ephemera";
import { clearSequences } from "store/sequences";
import { clearGPSTracks } from "store/gps";

import { allLayouts } from "store/framework";
import AboutOverlay from "./about-overlay";
import { useEffect, useRef, useState } from "react";
import { changeTime, halt, start } from "store/playhead";

library.add(faQuestionCircle, faCalendarAlt, faClock, faFloppyDisk);

export function LoaderHelpMenu() {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(true);

  const setModalIsOpen = (val: boolean) => {
    setIsOpen(val);
    if (val === false) {
      dispatch(start()); // start playback when help menu closes
    } else {
      dispatch(halt()); // stop playback when help menu opens
    }
  };

  return (
    <>
      <div
        className={styles.helpMenuButton}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
      >
        <div className={styles.verticalCenter}>
          <FontAwesomeIcon icon="question-circle" />
        </div>
      </div>
      <AboutOverlay modalIsOpen={isOpen} setModalIsOpen={setModalIsOpen} />
    </>
  );
}

export function LayoutDropdown() {
  const layout = useSelector((state: RootState) => state.framework.layout);

  const layoutDefinition = allLayouts[layout];
  const mainStyleName =
    layoutDefinition.cssGridRows === 9 ? layoutStyles.icon_9Rows : layoutStyles.icon_10Rows;
  const frames = [];
  for (let i = 1; i <= layoutDefinition.frameCount; i++) {
    // CSS Grid definitions
    const gridAreaName = layoutStyles[`f${i}`];
    frames.push(
      <div className={`${layoutStyles.iconFrameContainer} ${gridAreaName}`} key={`FRAME__${i}`}>
        <div className={layoutStyles.iconFrameBackground}></div>
      </div>
    );
  }

  return (
    <ModalDropdown modal={LayoutPicker} modalWidth={263} color="grey" caret="down">
      <div className={layoutStyles.layoutIconContainer} title="Choose display layout configuration">
        <div className={`${mainStyleName} ${layoutStyles[`layout_${layout}`]}`}>{frames}</div>
      </div>
    </ModalDropdown>
  );
}

export function PresetDropdown() {
  return (
    <ModalDropdown modal={PresetPicker} modalWidth={350} color="grey" caret="down">
      <div
        className={`${styles.verticalCenter} ${styles.preset}`}
        title="Save and load display presets"
      >
        <FontAwesomeIcon icon="floppy-disk" />
      </div>
    </ModalDropdown>
  );
}

export function ShareDropdown() {
  return (
    <ModalDropdown modal={SharePanel} modalWidth={350} color="grey" caret="down">
      <div
        className={`${styles.verticalCenter} ${styles.shareButton}`}
        title="Share this View of Current Playback Time"
      >
        <div className={styles.svgShare}></div>
      </div>
    </ModalDropdown>
  );
}

export function SourcesDropdown() {
  const dispatch = useDispatch();
  const selectedSource = useSelector((state: RootState) => state.framework.source);

  return (
    <div className={styles.select}>
      <select
        value={selectedSource}
        onChange={(e) => {
          dispatch(clearVideos());
          dispatch(clearPhotos());
          dispatch(clearEphemera());
          dispatch(clearGPSTracks());
          dispatch(clearSequences());
          dispatch(changeSource(e.target.value as Source));
        }}
      >
        <option value={Source.ISS}>ISS</option>
        <option value={Source.NBL}>NBL</option>
        <option value={Source.TEST_EVENTS}>Test Events</option>
      </select>
      <div className={styles.select_arrow}>
        <FontAwesomeIcon icon="chevron-down" />
      </div>
    </div>
  );
}

export function DatetimeDropdown() {
  const playheadDate = useSelector((state: RootState) => state.playhead.date);

  const date = new Date(playheadDate);
  const year = date.getUTCFullYear();
  const month = padZeros(date.getUTCMonth() + 1, 2);
  const day = padZeros(date.getUTCDate(), 2);

  return (
    <ModalDropdown modal={Calendar} color="grey" caret="down">
      <div className={styles.iconWithText}>
        <FontAwesomeIcon icon={["far", "calendar-alt"]} size={"sm"} />
        <span className={styles.date}>
          {year}-{month}-{day}
        </span>
      </div>
    </ModalDropdown>
  );
}

export function Clock() {
  const playheadSeconds = useSelector((state: RootState) => state.playhead.seconds);
  const dispatch = useDispatch();

  const [renderTime, setRenderTime] = useState("00:00:00");
  const [userTimeValue, setUserTimeValue] = useState("");
  const [editingTime, setEditingTime] = useState(false);

  const timeInput = useRef(null);

  useEffect(() => {
    setRenderTime(hhmmssFromSeconds(playheadSeconds));
  }, [playheadSeconds]);

  /** Navigates to a new time */
  const handleTimeChange = () => {
    if (userTimeValue !== "") {
      const [hh, mm = "00", ss = "00"] = userTimeValue.split(":");
      const newTime = +ss + 60 * +mm + 3600 * +hh;
      dispatch(changeTime(newTime));
      setRenderTime(userTimeValue);
    }

    setUserTimeValue("");
    setEditingTime(false);
  };

  const handleCancel = () => {
    setUserTimeValue("");
    setEditingTime(false);
  };

  const timeButtonsDisplay = editingTime ? "flex" : "none";

  return (
    <div className={styles.timeContainer}>
      <div className={styles.timeInputContainer}>
        <div className={`${styles.iconWithText} ${styles.clockIconContainer}`}>
          <FontAwesomeIcon icon={["far", "clock"]} size={"sm"} />
        </div>
        <input
          ref={timeInput}
          type="text"
          size={8}
          placeholder="hh:mm:ss"
          title="GMT"
          className={styles.timeField}
          id="missionTime"
          name="missionTime"
          value={editingTime ? userTimeValue : renderTime}
          // allow HH:MM or HH:MM:SS
          pattern="^(?:(?:([01]?\d|2[0-3]):[0-5]\d))(?::[0-5]\d)?$"
          onFocus={() => {
            setEditingTime(true);
            setUserTimeValue(renderTime);
          }}
          onChange={(e) => setUserTimeValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleTimeChange();
            }
          }}
        />
        <div className={`${styles.timeZulu} ${styles.clockIconContainer}`}>Z</div>
      </div>
      <div className={styles.timeButtonsContainer} style={{ display: timeButtonsDisplay }}>
        <button
          className={styles.timeButton}
          style={{ width: "50px" }}
          onClick={() => {
            handleCancel();
          }}
        >
          <span className={styles.timeButtonLabel}>Cancel</span>
        </button>
        <button
          className={styles.timeButton}
          style={{ width: "50px" }}
          onClick={() => {
            handleTimeChange();
          }}
        >
          <span className={styles.timeButtonLabel}>Go</span>
        </button>
      </div>
    </div>
  );
}

export default function Header() {
  const source = useSelector((state: RootState) => state.framework.source);
  return (
    <div className={styles.main}>
      <div className={styles.left}>
        <div className={styles.item}>
          <LoaderHelpMenu />
        </div>
        <div className={styles.item} style={{ width: "140px" }}>
          <SourcesDropdown />
        </div>
        <div className={styles.item} style={{ width: "180px" }}>
          <DatetimeDropdown />
        </div>
        <div className={styles.item} style={{ width: "130px" }}>
          <Clock />
        </div>
        <div className={`${styles.item} ${styles.eventDropdownWrapper}`}>
          <EventDropdown collection={Collection[source]} />
        </div>
        <div className={styles.item} style={{ width: "80px" }}>
          <LayoutDropdown />
        </div>
        <div className={styles.item} style={{ width: "60px" }}>
          <PresetDropdown />
        </div>
        <div className={styles.item} style={{ width: "60px" }}>
          <ShareDropdown />
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.item}>
          <StatusArea largeDisplay={false} />
        </div>
        <div className={styles.verticalCenter}>
          <span
            className={styles.wordMark}
            onClick={() => {
              window.open("https://wiki.jsc.nasa.gov/exploration/index.php/CODA", "_blank");
            }}
            title="More info about Collaborative Operations Data Activation (CODA)"
          >
            CODA
          </span>
        </div>
        <div className={styles.logoRight}>
          <div>
            <img className={styles.meatball} src="/images/logo_NASA.svg" alt="NASA meatball" />
          </div>
          <div
            className={styles.logoEmssWrapper}
            onClick={() => {
              window.open(
                "https://wiki.jsc.nasa.gov/exploration/index.php/EVA_Mission_System_Software",
                "_blank"
              );
            }}
            title="More info about EVA Mission System Software (EMSS)"
          >
            <span className={styles.logoEmss}></span>
          </div>
        </div>
      </div>
    </div>
  );
}
