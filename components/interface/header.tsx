import { useDispatch, useSelector } from "react-redux";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { faCalendarAlt, faClock } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "components/interface/button";
import Calendar from "components/interface/calendar";
import { ModalDropdown } from "components/interface/dropdown-v2";
import LayoutPicker from "components/framework/layout-picker";
import { RootState } from "store/index";
import styles from "./header.module.css";
import { hhmmssFromSeconds, padZeros } from "utils/formatting";
import { Collection, Source } from "utils/enums";
import StatusBar from "./status-bar";
import EventDropdown from "components/interface/eventDropdown";
import Share from "components/interface/share";
import { changeSource } from "store/framework";
import { clearVideos } from "store/videos";
import { clearPhotos } from "store/photos";
import { clearEphemera } from "store/ephemera";
import { clearSequences } from "store/sequences";
import { clearGPSTracks } from "store/gps";

library.add(faBars, faCalendarAlt, faClock);

export function HamburgerMenu() {
  return (
    <Button color="lightest-grey">
      <FontAwesomeIcon icon="bars" />
    </Button>
  );
}

export function LayoutDropdown() {
  return (
    <ModalDropdown modal={LayoutPicker} color="grey" caret="down">
      <img src="/icons/layout1.svg" alt="Layout 1" className={styles.layoutIcon} />
    </ModalDropdown>
  );
}

export function SourcesDropdown() {
  const dispatch = useDispatch();
  const selectedSource = useSelector((state: RootState) => state.framework.selectedSource);

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

  const time = hhmmssFromSeconds(playheadSeconds);

  return (
    <div className={styles.timeContainer}>
      <div className={`${styles.iconWithText} ${styles.verticalCenter}`}>
        <div>
          <FontAwesomeIcon icon={["far", "clock"]} size={"sm"} />
        </div>
        <div className={styles.time}>{time}Z</div>
      </div>
    </div>
  );
}

export default function Header() {
  const selectedSource = useSelector((state: RootState) => state.framework.selectedSource);
  return (
    <div className={styles.main}>
      <div className={styles.left}>
        <div className={styles.item}>
          <HamburgerMenu />
        </div>
        <div className={styles.item} style={{ width: "80px" }}>
          <LayoutDropdown />
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
        <div className={styles.item}>
          <EventDropdown collection={Collection[selectedSource]} />
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.verticalCenter}>
          <Share />
        </div>
        <div className={styles.verticalCenter}>
          <StatusBar />
        </div>
        <div className={styles.verticalCenter}>
          <img className={styles.meatball} src="/images/logo_NASA.svg" alt="NASA meatball" />
        </div>
        <div className={styles.verticalCenter}>
          <span className={styles.wordMark}>CODA</span>
        </div>
        <div className={styles.verticalCenter} style={{ color: "var(--lightest-grey)" }}>
          {/* TODO: this should be a skinny line, not a pipe character */}
          <span className={styles.wordMark}>|</span>
        </div>
        <div className={styles.verticalCenter}>
          <span className={styles.logoEmss}></span>
        </div>
      </div>
    </div>
  );
}
