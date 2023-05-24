import _ from "lodash";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { ModalDropdown } from "./dropdown-modal";
import { RootState } from "store/index";
import { diff, isSameDate } from "store/playhead";
import { getYearDayNumber, padZeros } from "utils/formatting";
import styles from "./calendar.module.css";
import { Source } from "utils/enums";
import { generateShareURL } from "utils/share-state";

const monthOnly: Intl.DateTimeFormatOptions = {
  month: "long",
  timeZone: "UTC",
};

const intlMonthOnly = new Intl.DateTimeFormat("en-CODA", monthOnly);

const allMonths = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

export function MonthsModal({
  closeClick,
  options: { visibleYearMonth, setVisibleYearMonth },
}: {
  closeClick?: () => void;
  options: {
    visibleYearMonth: string;
    setVisibleYearMonth: (ym: string) => void;
  };
}) {
  const [yyyy, mm] = visibleYearMonth.split("-");
  const zeroIndexedMonth = +mm - 1;

  return (
    <div className={styles.monthModal}>
      {allMonths.map((month, index) => {
        return (
          <div
            key={month}
            className={styles.option}
            onClick={(e) => {
              e.preventDefault();
              setVisibleYearMonth(`${yyyy}-${padZeros(index + 1, 2)}`);
              closeClick();
            }}
          >
            <span className={styles.checkbox}>
              <span style={{ display: index === zeroIndexedMonth ? "inline" : "none" }}>✓</span>
            </span>
            <span>{month}</span>
          </div>
        );
      })}
    </div>
  );
}

export function YearsModal({
  closeClick,
  options: { visibleYearMonth, setVisibleYearMonth },
}: {
  closeClick?: () => void;
  options: {
    visibleYearMonth: string;
    setVisibleYearMonth: (ym: string) => void;
  };
}) {
  const [yyyy, mm] = visibleYearMonth.split("-");

  const now = new Date();
  const nowYear = now.getUTCFullYear();
  const issLaunch = new Date("2000-01-01T00:00Z");
  const issLaunchYear = issLaunch.getUTCFullYear();

  const years = [];
  for (let i = issLaunchYear; i <= nowYear; i++) {
    years.push(i);
  }

  return (
    <div className={styles.monthModal}>
      {years.map((_, i) => {
        const year = nowYear - i;

        return (
          <div
            key={year}
            className={styles.option}
            onClick={(e) => {
              e.preventDefault();
              setVisibleYearMonth(`${year}-${mm}`);
              closeClick();
            }}
          >
            <span className={styles.checkbox}>
              <span style={{ display: year === +yyyy ? "inline" : "none" }}>✓</span>
            </span>
            <span>{year}</span>
          </div>
        );
      })}
    </div>
  );
}

interface DateDescription {
  date: Date;
  /** Is the calendar day the same as today */
  isToday: boolean;
  /** Is the calendar day the same as the playhead day */
  isPlayheadDay: boolean;
  /** In the same month that's visible */
  inMonth: boolean;
  /** Is a date in the future */
  isLater: boolean;
  /** The EVA happening on a date (when applicable; `undefined` otherwise) */
  EVA: Sequence;
}

export function CalendarDate({
  description,
  closeClick,
}: {
  description: DateDescription;
  closeClick: () => void;
}) {
  const framework = useSelector((state: RootState) => state.framework);
  const playhead = useSelector((state: RootState) => state.playhead);

  let dayOfYearColor = "var(--even-greyer)";
  let toolTipText = "";
  const classes = [styles.calendarDate];
  if (description.inMonth && !description.isLater) {
    classes.push(styles.greyBkg);
  }

  if (description.isToday) {
    classes.push(styles.bordered);
  }

  if (description.isPlayheadDay) {
    classes.push(styles.inverted);
    dayOfYearColor = "var(--dark-grey)";
  }

  if (!description.inMonth && !description.isLater) {
    classes.push(styles.greyText);
    classes.push(styles.darkerGrayBkg);
    dayOfYearColor = "var(--lighter-grey)";
  }

  if (description.isLater) {
    classes.push(styles.greyText);
    dayOfYearColor = "var(--lighter-grey)";
    toolTipText = "No content in CODA from future dates";
  }

  if (!description.isLater) {
    classes.push(styles.clickable);
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!description.isLater) {
      const formattedDate = `${description.date.getUTCFullYear()}-${padZeros(
        description.date.getUTCMonth() + 1,
        2
      )}-${padZeros(description.date.getUTCDate(), 2)}`;
      let URL = generateShareURL(framework, playhead);
      // replace the datestring in URL with selected calendar date
      URL = URL.replace(/\d{4}-\d{2}-\d{2}/, formattedDate);
      window.location.assign(URL);
      closeClick();
    }
  };

  return (
    <div onClick={handleClick} title={toolTipText}>
      {!_.isNil(description.EVA) && (
        <div
          title={description.EVA.name}
          className={`${styles.dot} ${
            description.EVA.displayTitle.startsWith("RS") ? styles.aqua : styles.orange
          }`}
        >
          •
        </div>
      )}
      <div className={classes.join(" ")}>
        <div className={styles.verticalCenter}>
          <div className={styles.dateCellDayOfMonth}>{description.date.getUTCDate()}</div>
          <div
            className={`${styles.dateCellDayOfYear} ${
              description.isPlayheadDay && styles.inverted
            }`}
            style={{ color: dayOfYearColor }}
          >
            {getYearDayNumber(description.date)}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Renders a calendar */
export default function Calendar({ closeClick }: { closeClick?: () => void }) {
  const framework = useSelector((state: RootState) => state.framework);
  const sequences = useSelector((state: RootState) => state.sequences);
  const playheadDate = useSelector((state: RootState) => state.playhead.date);
  const source = useSelector((state: RootState) => state.framework.source);

  let allSequences = sequences.allSequences;
  if (source === Source.NBL) {
    // Show only NBL sequences
    allSequences = allSequences.filter((eva) => eva.displayTitle.includes("NBL"));
  } else if (source === Source.TEST_EVENTS) {
    // Filter out all NBL sequences
    allSequences = allSequences.filter((eva) => !eva.displayTitle.includes("NBL"));
  } else if (source === Source.ARTEMIS) {
    // Filter out all sequences because there's nothing to show in the dropdown for Artemis (currently)
    allSequences = [];
  }

  const today = new Date();
  const playheadDay = new Date(playheadDate);
  const todayYYYY = today.getUTCFullYear();
  const todayMM = padZeros(today.getUTCMonth() + 1, 2);

  /** Form of 'yyyy-mm' */
  const [visibleYearMonth, setVisibleYearMonth] = useState(`${todayYYYY}-${todayMM}`);

  // if the playhead date changes, change the calendar too
  useEffect(() => {
    const date = new Date(playheadDate);
    const mm = padZeros(date.getUTCMonth() + 1, 2);
    const yyyy = date.getUTCFullYear();
    setVisibleYearMonth(`${yyyy}-${mm}`);
  }, [playheadDate]);

  // figure out which month to render
  const firstOfMonth = new Date(`${visibleYearMonth}-01T00:00Z`);
  const mm = firstOfMonth.getUTCMonth();
  const yyyy = firstOfMonth.getUTCFullYear();
  const dayOfWeek = firstOfMonth.getUTCDay();

  // figure out which dates to render in the calendar
  const datesToRender: DateDescription[] = [];
  const iterDate = new Date(firstOfMonth);
  iterDate.setUTCDate(1 - dayOfWeek);

  // 7 days in a week * 6 rows = 42 dates to render
  for (let i = 0; i < 42; i++) {
    const d = iterDate.getUTCDate();
    const inMonth = iterDate.getUTCMonth() === mm;
    const isToday = isSameDate(iterDate, today);
    const isPlayheadDay = isSameDate(iterDate, playheadDay);
    const isLater = diff(today, iterDate) < 0;

    const EVA = allSequences.find((seq) => isSameDate(new Date(seq.startDate), iterDate));

    datesToRender.push({
      date: new Date(iterDate),
      inMonth,
      isToday,
      isPlayheadDay,
      isLater,
      EVA,
    });
    iterDate.setUTCDate(d + 1);
  }

  const monthString = intlMonthOnly.format(firstOfMonth);

  return (
    <div className={styles.main}>
      <div className={styles.top}>
        <div>Select a Date</div>
        {closeClick && (
          <div className={styles.close} onClick={closeClick}>
            ✕
          </div>
        )}
      </div>
      <div className={styles.monthAndYear}>
        <div style={{ width: "206px", height: "29px" }}>
          <ModalDropdown
            size="medium"
            color="grey"
            modal={MonthsModal}
            modalOptions={{ visibleYearMonth, setVisibleYearMonth }}
          >
            <>&nbsp;{monthString}</>
          </ModalDropdown>
        </div>
        <div style={{ width: "104px", height: "29px" }}>
          <ModalDropdown
            size="medium"
            color="grey"
            modal={YearsModal}
            modalOptions={{ visibleYearMonth, setVisibleYearMonth }}
          >
            <>&nbsp;{yyyy}</>
          </ModalDropdown>
        </div>
      </div>
      <div className={styles.days}>
        {datesToRender.map((d, index) => {
          return (
            <div key={`CALENDAR_DATE__${yyyy}__${mm}__${index}`}>
              <CalendarDate description={d} closeClick={closeClick} />
            </div>
          );
        })}
      </div>
      <div className={styles.events}>
        <div className={styles.labels}>
          <div className={`${styles.dotdiv} ${styles.orangeBkg}`}></div>
          <span style={{ margin: "5px" }}>
            {framework.source === Source.ISS ? "EVA (US)" : "Event"}
          </span>
          &nbsp;&nbsp;
          {framework.source === Source.ISS && (
            <>
              <div className={`${styles.dotdiv} ${styles.aquaBkg}`}></div>
              <span style={{ margin: "5px" }}>EVA (RS)</span>
            </>
          )}
          {/* <span className={`${styles.aqua}`}>•</span> IVA or Other Event */}
        </div>
      </div>
    </div>
  );
}
