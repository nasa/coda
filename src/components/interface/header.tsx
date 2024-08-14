import { useDispatch, useSelector } from "react-redux";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faCalendarAlt, faClock, faQuestionCircle } from "@fortawesome/free-regular-svg-icons";
import { faEye } from "@fortawesome/free-solid-svg-icons";
import { faFloppyDisk } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Calendar from "components/interface/calendar";
import { ModalDropdown } from "components/interface/dropdown-modal";
import LayoutPicker from "components/framework/layout-picker";
import PresetPicker from "components/framework/preset-picker";
import { RootState } from "store/index";
import styles from "./header.module.css";
import layoutStyles from "/components/framework/frames.module.css";
import { appSecondsFromDateString, hhmmssFromSeconds, padZeros } from "utils/formatting";
import { collection, sourceShortVal } from "utils/consts";
import StatusArea from "./status";
import EventDropdown from "components/interface/dropdown-event";
import SharePanel from "components/interface/share";

import { allLayouts, setEmssVideoEnabled } from "store/framework";
import AboutOverlay from "./about-overlay";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { changeTime, halt, start } from "store/playhead";
import { generateShareURL } from "utils/share-state";
import { isSameDate } from "utils/date";

library.add(faQuestionCircle, faCalendarAlt, faClock, faFloppyDisk);

export function LoaderHelpMenu(props: { helpLoaderOpen: boolean; setHelpLoaderOpen: Function }) {
  const dispatch = useDispatch();

  const setModalIsOpen = (val: boolean) => {
    props.setHelpLoaderOpen(val);
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
          props.setHelpLoaderOpen(!props.helpLoaderOpen);
        }}
      >
        <div className={styles.verticalCenter}>
          <FontAwesomeIcon icon="question-circle" />
        </div>
      </div>
      <AboutOverlay modalIsOpen={props.helpLoaderOpen} setModalIsOpen={setModalIsOpen} />
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
  const framework = useSelector((state: RootState) => state.framework);
  const playhead = useSelector((state: RootState) => state.playhead);

  const handleSourceChange = (e: ChangeEvent<HTMLSelectElement>) => {
    let URL = generateShareURL(framework, playhead);

    const value = e.target.value;

    if (value in sourceShortVal) {
      const sourceParam = sourceShortVal[value as keyof typeof sourceShortVal];
      // replace the source in URL with selected source
      URL = URL.replace(/s=([^&]*)/, `s=${sourceParam}`);

      window.location.assign(URL);
    }
  };

  return (
    <div className={styles.select}>
      <select
        value={framework.source}
        onChange={(e) => {
          handleSourceChange(e);
        }}
      >
        <option value={"ARTEMIS"}>ARTEMIS</option>
        <option value={"ISS"}>ISS</option>
        <option value={"NBL"}>NBL</option>
        <option value={"TEST_EVENTS"}>Test Events</option>
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

  /** Navigates to most recent time, "live" */
  const handleLive = () => {
    const timeLive = appSecondsFromDateString(new Date().toISOString());
    setRenderTime(hhmmssFromSeconds(timeLive));
    dispatch(changeTime(timeLive));
    setUserTimeValue("");
    setEditingTime(false);
  };

  const windowURL = window.location;
  let paramDate = String(windowURL).match(/\d{4}-\d{2}-\d{2}/);
  var today = new Date();
  if (paramDate) {
    let [year, month, day] = paramDate[0].split("-");
    var urlDate = new Date(`${year}-${month}-${day}`);
  } else {
    // This is a safety parameter, so that isSameDate doesnt have an undefined.
    urlDate = new Date();
  }

  let timeButtonsDisplay = editingTime ? "grid" : "none";

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
          className={`${styles.timeButtonsItems} ${styles.timeButtons}`}
          onClick={() => {
            handleCancel();
          }}
        >
          <span>Cancel</span>
        </button>
        <button
          className={`${styles.timeButtonsItems}`}
          onClick={() => {
            handleTimeChange();
          }}
        >
          <span>Go</span>
        </button>
        {isSameDate(urlDate, today) ? (
          <button
            className={`${styles.timeButtonsItems} ${styles.timeButtons} ${styles.timeButtonLive}`}
            onClick={() => {
              handleLive();
            }}
          >
            <div className={styles.liveButtonText}>
              <div className={styles.liveButtonIcon}></div>
              <span>Live</span>
            </div>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SocketStatus(props: { socketStatus: SocketStatus }) {
  return (
    <div
      className={styles.userCount}
      data-tooltip-id="app-tooltip"
      data-tooltip-html={
        props.socketStatus.connectionStatus === "connected"
          ? `CODA Visitors: ${props.socketStatus.lastStatusFromServer.viewers || 0}`
          : "Connection to server lost"
      }
      style={
        props.socketStatus.connectionStatus === "connected"
          ? { color: "var(--greyish)" }
          : { color: "var(--even-greyer)" }
      }
    >
      <FontAwesomeIcon className={styles.userCountIcon} icon={faEye} />
      <div className={styles.userCountText}>
        {props.socketStatus.lastStatusFromServer.viewers || 0}
      </div>
    </div>
  );
}

export default function Header(props: {
  helpLoaderOpen: boolean;
  setHelpLoaderOpen: Function;
  socketStatus: SocketStatus;
}) {
  const source = useSelector((state: RootState) => state.framework.source);
  const emssVideoEnabled = useSelector((state: RootState) => state.framework.emssVideoEnabled);
  const dispatch = useDispatch();
  return (
    <div className={styles.main}>
      <div className={styles.left}>
        <div className={styles.item}>
          <LoaderHelpMenu
            helpLoaderOpen={props.helpLoaderOpen}
            setHelpLoaderOpen={props.setHelpLoaderOpen}
          />
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
          <EventDropdown
            collection={collection[source]}
            setHelpLoaderOpen={props.setHelpLoaderOpen}
          />
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
        <div>
          <SocketStatus socketStatus={props.socketStatus} />
        </div>
        <div className={styles.item}>
          <StatusArea largeDisplay={false} />
        </div>
        <div className={styles.verticalCenter}>
          <span
            className={styles.wordMark}
            onClick={() => {
              window.location.assign(location.origin);
            }}
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
            // onClick={() => {
            //   window.open(
            //     "https://wiki.jsc.nasa.gov/exploration/index.php/EVA_Mission_System_Software",
            //     "_blank"
            //   );
            // }}
            onClick={() => {
              dispatch(setEmssVideoEnabled(!emssVideoEnabled));
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
