import { useDispatch, useSelector } from "react-redux";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faCalendarAlt, faClock, faQuestionCircle } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Calendar from "components/interface/calendar";
import { ModalDropdown } from "components/interface/dropdown-modal";
import LayoutPicker from "components/framework/layout-picker";
import { RootState } from "store/index";
import styles from "./header.module.css";
import layoutStyles from "/components/framework/frames.module.css";
import { hhmmssFromSeconds, padZeros } from "utils/formatting";
import { Collection, Source } from "utils/enums";
import StatusArea from "./status";
import EventDropdown from "components/interface/dropdown-event";
import Share from "components/interface/share";
import { changeSource } from "store/framework";
import { clearVideos } from "store/videos";
import { clearPhotos } from "store/photos";
import { clearEphemera } from "store/ephemera";
import { clearSequences } from "store/sequences";
import { clearGPSTracks } from "store/gps";

import { allLayouts } from "store/framework";
import AboutOverlay from "./about-overlay";
import { useState } from "react";

library.add(faQuestionCircle, faCalendarAlt, faClock);

export function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(true);

  const closeModalCB = () => {
    setIsOpen(false);
  };

  return (
    <>
      <div
        className={styles.hamburgerButton}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
      >
        <div className={styles.verticalCenter}>
          <FontAwesomeIcon icon="question-circle" />
        </div>
      </div>
      <AboutOverlay modalIsOpen={isOpen} closeModalCB={closeModalCB} />
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
    <ModalDropdown modal={LayoutPicker} color="grey" caret="down">
      <div className={layoutStyles.layoutIconContainer}>
        <div className={`${mainStyleName} ${layoutStyles[`layout_${layout}`]}`}>{frames}</div>
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
  const source = useSelector((state: RootState) => state.framework.source);
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
        <div className={styles.item} style={{ width: "300px" }}>
          <EventDropdown collection={Collection[source]} />
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.item}>
          <Share />
        </div>
        <div className={styles.item}>
          <StatusArea largeDisplay={false} />
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
