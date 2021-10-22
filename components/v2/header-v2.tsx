import { useSelector } from "react-redux";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { faCalendarAlt, faClock } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "components/v2/button";
import Calendar from "components/v2/calendar";
import { ModalDropdown } from "components/v2/dropdown-v2";
import LayoutPicker from "components/v2/layout-picker";
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
    <ModalDropdown modal={LayoutPicker} color="grey" caret="down">
      <img src="/icons/layout1.svg" alt="Layout 1" className={styles.layoutIcon} />
    </ModalDropdown>
  );
}

export function SourcesDropdown() {
  return (
    <ModalDropdown modal={LayoutPicker} color="grey" caret="down">
      <span>&nbsp;ISS</span>
    </ModalDropdown>
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
        <FontAwesomeIcon icon={["far", "calendar-alt"]} />
        &nbsp;&nbsp;
        <span className={styles.mono}>
          {year}-{month}-{day}
        </span>
      </div>
    </ModalDropdown>
  );
}

export function ClockDropdown() {
  const playheadSeconds = useSelector((state: RootState) => state.playhead.seconds);

  const time = hhmmssFromSeconds(playheadSeconds);

  return (
    <ModalDropdown modal={Calendar} color="grey" caret="none">
      <div className={styles.iconWithText}>
        <FontAwesomeIcon icon={["far", "clock"]} />
        &nbsp;
        <span className={`${styles.mono} ${styles.time}`}>{time}</span>
      </div>
    </ModalDropdown>
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
