import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { faCalendarAlt, faClock, faQuestionCircle } from "@fortawesome/free-regular-svg-icons";
import { faChevronDown, faEye, faFloppyDisk } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Calendar } from "components/interface/calendar";
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
import { FunctionComponent, ChangeEvent, useEffect, useRef, useState } from "react";
import { generateShareURL } from "utils/share-state";
import { isSameDate } from "utils/date";
import { usePlayheadContext } from "store/contextProviders/playheadContext";
import { isSuperuser } from "utils/user";

const LoaderHelpMenu: FunctionComponent<{
  helpLoaderOpen: boolean;
  setHelpLoaderOpen: (val: boolean) => void;
}> = ({ helpLoaderOpen, setHelpLoaderOpen }) => {
  const { dispatchPlayhead } = usePlayheadContext();

  const setModalIsOpen = (val: boolean) => {
    setHelpLoaderOpen(val);
    if (val === false) {
      dispatchPlayhead({ type: "START" }); // start playback when help menu closes
    } else {
      dispatchPlayhead({ type: "STOP" }); // stop playback when help menu opens
    }
  };

  return (
    <>
      <div
        className={styles.helpMenuButton}
        onClick={() => {
          setHelpLoaderOpen(!helpLoaderOpen);
        }}
      >
        <div className={styles.verticalCenter}>
          <FontAwesomeIcon icon={faQuestionCircle} />
        </div>
      </div>
      <AboutOverlay modalIsOpen={helpLoaderOpen} setModalIsOpen={setModalIsOpen} />
    </>
  );
};

const LayoutDropdown: FunctionComponent = () => {
  const layout = useAppSelector((state: RootState) => state.framework.layout, refEqual);

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
};

const PresetDropdown: FunctionComponent = () => (
  <ModalDropdown modal={PresetPicker} modalWidth={350} color="grey" caret="down">
    <div
      className={`${styles.verticalCenter} ${styles.preset}`}
      title="Save and load display presets"
    >
      <FontAwesomeIcon icon={faFloppyDisk} />
    </div>
  </ModalDropdown>
);

const ShareDropdown: FunctionComponent = () => (
  <ModalDropdown modal={SharePanel} modalWidth={350} color="grey" caret="down">
    <div
      className={`${styles.verticalCenter} ${styles.shareButton}`}
      title="Share this View of Current Playback Time"
    >
      <div className={styles.svgShare}></div>
    </div>
  </ModalDropdown>
);

const LiveButton: FunctionComponent = () => {
  const { playhead, dispatchPlayhead } = usePlayheadContext();
  const LIVE_THRESHOLD_SECONDS = 5;

  const handleLive = () => {
    const timeLive = appSecondsFromDateString(new Date().toISOString());
    dispatchPlayhead({ type: "SET_APP_SECONDS", payload: timeLive });
  };

  const isLiveEnabled = import.meta.env.VITE_PUBLIC_LIVE_STREAMS_ENABLED === "true";
  const isToday = isSameDate(new Date(playhead.date), new Date());
  const currentLiveTime = appSecondsFromDateString(new Date().toISOString());
  const isNearLive = Math.abs(playhead.appSeconds - currentLiveTime) <= LIVE_THRESHOLD_SECONDS;

  if (!isLiveEnabled || !isToday) return null;

  return isNearLive ? (
    <div className={styles.liveIndicator} title="Currently Live">
      <div className={styles.liveIndicatorIcon}></div>
      <div className={styles.liveIndicatorText}>Live</div>
    </div>
  ) : (
    <div
      className={`${styles.verticalCenter} ${styles.liveButton}`}
      title="Go Live"
      onClick={handleLive}
    >
      Go Live
    </div>
  );
};

const SourcesDropdown: FunctionComponent = () => {
  const framework = useAppSelector((state: RootState) => state.framework, deepEqual);

  const { playhead } = usePlayheadContext();

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
        <FontAwesomeIcon icon={faChevronDown} />
      </div>
    </div>
  );
};

const DatetimeDropdown: FunctionComponent = () => {
  const { playhead } = usePlayheadContext();

  const date = new Date(playhead.date);
  const year = date.getUTCFullYear();
  const month = padZeros(date.getUTCMonth() + 1, 2);
  const day = padZeros(date.getUTCDate(), 2);

  return (
    <ModalDropdown modal={Calendar} color="grey" caret="down">
      <div className={styles.iconWithText}>
        <FontAwesomeIcon icon={faCalendarAlt} size={"sm"} />
        <span className={styles.date}>
          {year}-{month}-{day}
        </span>
      </div>
    </ModalDropdown>
  );
};

const Clock: FunctionComponent = () => {
  const [renderTime, setRenderTime] = useState("00:00:00");
  const [userTimeValue, setUserTimeValue] = useState("");
  const [editingTime, setEditingTime] = useState(false);

  const { playhead, dispatchPlayhead } = usePlayheadContext();

  const timeInput = useRef(null);

  useEffect(() => {
    setRenderTime(hhmmssFromSeconds(playhead.appSeconds));
  }, [playhead.appSeconds]);

  /** Navigates to a new time */
  const handleTimeChange = () => {
    if (userTimeValue !== "") {
      const [hh, mm = "00", ss = "00"] = userTimeValue.split(":");
      const newTime = +ss + 60 * +mm + 3600 * +hh;
      dispatchPlayhead({ type: "SET_APP_SECONDS", payload: newTime });
      setRenderTime(userTimeValue);
    }

    setUserTimeValue("");
    setEditingTime(false);
  };

  const handleCancel = () => {
    setUserTimeValue("");
    setEditingTime(false);
  };

  let timeButtonsDisplay = editingTime ? "grid" : "none";

  return (
    <div className={styles.timeContainer}>
      <div className={styles.timeInputContainer}>
        <div className={`${styles.iconWithText} ${styles.clockIconContainer}`}>
          <FontAwesomeIcon icon={faClock} size={"sm"} />
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
      </div>
    </div>
  );
};

export const SocketStatus: FunctionComponent<{ socketStatus: SocketStatus }> = ({
  socketStatus,
}) => {
  const isSu = useAppSelector((state: RootState) => isSuperuser(state.user.user), refEqual);

  let visitorList = "";
  if (isSu) {
    let visitors: { [uupic: string]: number } = {};
    socketStatus.lastStatusFromServer.users.forEach((user) => {
      if (user.uupic) {
        visitors[user.uupic] = (visitors[user.uupic] || 0) + 1;
      }
    });
    // Filter out duplicate users, sort by surname, and decide display name
    visitorList =
      "<br/>" +
      socketStatus.lastStatusFromServer.users
        .filter(
          (user, index) =>
            socketStatus.lastStatusFromServer.users.findIndex(
              (visitor) => visitor?.uupic === user?.uupic
            ) === index
        )
        .sort((a, b) => {
          const sa = a.surname || "";
          const sb = b.surname || "";
          return sa.localeCompare(sb);
        })
        .map(
          (user) =>
            `(${visitors[user.uupic] || "1"}) ${user?.display_name}` ||
            `(${visitors[user.uupic] || "1"}) ${user?.surname}, ${user?.givenname}`
        )
        .join("<br/>");
  } else {
    visitorList = socketStatus.lastStatusFromServer.users?.length.toString() || "0";
  }
  return (
    <div
      className={styles.userCount}
      data-tooltip-id="app-tooltip"
      data-tooltip-html={
        socketStatus.connectionStatus === "connected"
          ? `CODA Visitors: ${visitorList}`
          : "Connection to server lost"
      }
      style={
        socketStatus.connectionStatus === "connected"
          ? { color: "var(--greyish)" }
          : { color: "var(--even-greyer)" }
      }
    >
      <FontAwesomeIcon className={styles.userCountIcon} icon={faEye} />
      <div className={styles.userCountText}>
        {socketStatus.lastStatusFromServer.users?.length || 0}
      </div>
    </div>
  );
};

const Header: FunctionComponent<{
  helpLoaderOpen: boolean;
  setHelpLoaderOpen: (val: boolean) => void;
  socketStatus: SocketStatus;
}> = ({ helpLoaderOpen, setHelpLoaderOpen, socketStatus }) => {
  const source = useAppSelector((state: RootState) => state.framework.source, refEqual);
  const emssVideoEnabled = useAppSelector(
    (state: RootState) => state.framework.emssVideoEnabled,
    refEqual
  );
  const { playhead } = usePlayheadContext();
  const isToday = isSameDate(new Date(playhead.date), new Date());

  const dispatch = useAppDispatch();
  return (
    <div className={styles.main}>
      <div className={styles.left}>
        <div className={styles.item}>
          <LoaderHelpMenu helpLoaderOpen={helpLoaderOpen} setHelpLoaderOpen={setHelpLoaderOpen} />
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
        {isToday && (
          <div className={styles.item} style={{ width: "80px" }}>
            <LiveButton />
          </div>
        )}
        <div className={`${styles.item} ${styles.eventDropdownWrapper}`}>
          <EventDropdown collection={collection[source]} />
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
          <SocketStatus socketStatus={socketStatus} />
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
};

export default Header;
