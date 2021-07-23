import { useSelector } from "react-redux";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faBars, faCalendarAlt, faClock } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "components/button";
import Calendar from "components/calendar";
import { PseudoDropdown } from "components/dropdown-v2";
import LayoutPicker from "components/layout-picker";
import { RootState } from "store/index";
import styles from "./header-v2.module.css";
import { hhmmssFromSeconds, padZeros } from "utils/formatting";

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
    <PseudoDropdown modal={LayoutPicker} color="grey" caret="down">
      <img src="/icons/layout1.svg" alt="Layout 1" className={styles.layoutIcon} />
    </PseudoDropdown>
  );
}

export function SourcesDropdown() {
  return (
    <PseudoDropdown modal={LayoutPicker} color="grey" caret="down">
      <span>&nbsp;ISS</span>
    </PseudoDropdown>
  );
}

export function DatetimeDropdown() {
  const playheadDate = useSelector((state: RootState) => state.playhead.date);

  const date = new Date(playheadDate);
  const year = date.getUTCFullYear();
  const month = padZeros(date.getUTCMonth() + 1, 2);
  const day = padZeros(date.getUTCDate(), 2);

  return (
    <PseudoDropdown modal={Calendar} color="grey" caret="down">
      <div className={styles.iconWithText}>
        <FontAwesomeIcon icon="calendar-alt" />
        &nbsp;&nbsp;
        <span className={styles.mono}>
          {year}-{month}-{day}
        </span>
      </div>
    </PseudoDropdown>
  );
}

export function ClockDropdown() {
  const playheadSeconds = useSelector((state: RootState) => state.playhead.seconds);

  const time = hhmmssFromSeconds(playheadSeconds);

  return (
    <PseudoDropdown modal={Calendar} color="grey" caret="none">
      <div className={styles.iconWithText}>
        <FontAwesomeIcon icon="clock" />
        &nbsp;
        <span className={`${styles.mono} ${styles.time}`}>{time}</span>
      </div>
    </PseudoDropdown>
  );
}

export default function Header() {
  return (
    <div className={styles.main}>
      <div className={styles.left}>
        <div className={styles.item}>
          <HamburgerMenu />
        </div>
        <div className={styles.item} style={{ width: "72px" }}>
          <LayoutDropdown />
        </div>
        <div className={styles.item} style={{ width: "87px" }}>
          <SourcesDropdown />
        </div>
        <div className={styles.item} style={{ width: "197px" }}>
          <DatetimeDropdown />
        </div>
        <div className={styles.item} style={{ width: "150px" }}>
          <ClockDropdown />
        </div>
      </div>
      <div className={styles.right}>
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
          <span className={styles.wordMark}>EMSS</span>
        </div>
      </div>
    </div>
  );
}
