import { FunctionComponent, useMemo, useState } from "react";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { usePlayheadDate } from "store/hooks";
import { useAppDispatch } from "utils/useAppDispatch";
import { ModalDropdown } from "./dropdown-modal";
import { getYearDayNumber, padZeros } from "utils/formatting";
import styles from "./calendar.module.css";
import { diff, isSameDate, midnightZulu } from "../../utils/date";
import isNil from "lodash/isNil";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { thunkChangeViewingDate } from "store/thunk/clockThunk";
import type { AppDispatch } from "store/index";

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
  EVA?: Sequence;
}

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

interface YearMonthModalOptions {
  visibleYearMonth: string;
  setVisibleYearMonth: (ym: string) => void;
}

const handleDateChange = (description: DateDescription, dispatch: AppDispatch) => {
  const formattedDate = `${description.date.getUTCFullYear()}-${padZeros(
    description.date.getUTCMonth() + 1,
    2
  )}-${padZeros(description.date.getUTCDate(), 2)}`;

  // Update URL without reloading
  const url = new URL(window.location.href);
  url.searchParams.set("date", formattedDate);
  url.searchParams.set("gmt", "00:00:00");
  window.history.replaceState({}, "", url.toString());

  // Clear stores and change to new date (socket will reconnect automatically)
  dispatch(
    thunkChangeViewingDate({
      newDate: midnightZulu(description.date).toISOString(),
      newAppSeconds: 0,
    })
  );
};

export const MonthsModal: FunctionComponent<{
  closeClick?: () => void;
  options?: YearMonthModalOptions;
}> = ({ closeClick, options }) => {
  const visibleYearMonth = options?.visibleYearMonth ?? "";
  const setVisibleYearMonth = options?.setVisibleYearMonth;
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
              setVisibleYearMonth?.(`${yyyy}-${padZeros(index + 1, 2)}`);
              closeClick?.();
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
};

export const YearsModal: FunctionComponent<{
  closeClick?: () => void;
  options?: YearMonthModalOptions;
}> = ({ closeClick, options }) => {
  const visibleYearMonth = options?.visibleYearMonth ?? "";
  const setVisibleYearMonth = options?.setVisibleYearMonth;
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
              setVisibleYearMonth?.(`${year}-${mm}`);
              closeClick?.();
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
};

const CalendarDate: FunctionComponent<{
  description: DateDescription;
  closeClick?: () => void;
}> = ({ description, closeClick }) => {
  const dispatch = useAppDispatch();

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
      handleDateChange(description, dispatch);
      closeClick?.();
    }
  };

  return (
    <div onClick={handleClick} title={toolTipText}>
      {!isNil(description.EVA) && (
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
};

const DayOfYearPicker: FunctionComponent = () => {
  const dispatch = useAppDispatch();
  const playheadDate = usePlayheadDate();

  const allSequences = useAppSelector((state) => state.sequences.allSequences, deepEqual);

  const today = new Date();
  const todayYYYY = today.getUTCFullYear();
  const todayMM = padZeros(today.getUTCMonth() + 1, 2);

  const [visibleYearMonth, setVisibleYearMonth] = useState(`${todayYYYY}-${todayMM}`);
  const [day, setDay] = useState("");

  const setDate = new Date(+visibleYearMonth.split("-")[0], 0, parseInt(day));

  const isFuture = diff(today, setDate) < 0;

  // Check if the date is before existence of recording
  const earliestCutoff = new Date("2013-03-30");
  const isbeforeRecording = diff(setDate, earliestCutoff) < 0;

  const buttonClasses = [styles.datePickerButton];

  if (isFuture || isbeforeRecording) {
    buttonClasses.push(styles.unselectableButton);
  } else {
    buttonClasses.push(styles.selectableButton);
  }

  let errorDateMessage = "";
  if (isFuture) {
    errorDateMessage = "Day is in the future";
  } else if (isbeforeRecording) {
    errorDateMessage = "No EVA recording avaiable before 2013-03-30.";
  }

  return (
    <>
      <div style={{ display: "flex" }}>
        <h1 className={styles.datePickerHeader}>Select a Day</h1>
        {isbeforeRecording || isFuture ? (
          <div className={styles.errorMessageContainer}>
            <FontAwesomeIcon icon={faTriangleExclamation} size={"lg"} />
            <h1 className={styles.datePickerError}>{errorDateMessage}</h1>
          </div>
        ) : null}
      </div>
      <div className={styles.datePicker}>
        <div style={{ width: "104px", height: "29px", marginRight: "10px" }}>
          <ModalDropdown
            size="medium"
            color="grey"
            modal={YearsModal}
            modalOptions={{ visibleYearMonth, setVisibleYearMonth }}
          >
            <>&nbsp;{visibleYearMonth.split("-")[0]}</>
          </ModalDropdown>
        </div>
        <input
          className={styles.datePickerInput}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          placeholder="Day"
          style={{ width: "45px", height: "29px", margin: "0 10px" }}
          onChange={(e) => {
            // regex to check if input is a number
            const re = /^[0-9\b]+$/;

            // only allow 3 characters
            const val = e.target.value.slice(0, 3);

            if (val === "" || (re.test(val) && parseInt(val) > 0)) {
              setDay(val);
            }
          }}
          value={day}
        />
        <button
          className={buttonClasses.join(" ")}
          style={{ margin: "0 10px" }}
          onClick={(e) => {
            e.preventDefault();

            if (day === "" || isFuture) {
              return;
            }

            const date = setDate;

            const EVA = allSequences.find((seq) => isSameDate(new Date(seq.startDate), date));
            const inMonth = date.getUTCMonth() === today.getUTCMonth();
            const isPlayheadDay = isSameDate(date, new Date(playheadDate));
            const isToday = isSameDate(date, today);

            handleDateChange(
              {
                date,
                isToday,
                isPlayheadDay,
                inMonth,
                isLater: isFuture,
                EVA,
              },
              dispatch
            );
          }}
        >
          <span>Go</span>
        </button>
      </div>
    </>
  );
};

/** Renders a calendar */
export const Calendar: FunctionComponent<{ closeClick?: () => void }> = ({ closeClick }) => {
  const framework = useAppSelector((state) => state.framework, deepEqual);
  const sequences = useAppSelector((state) => state.sequences, deepEqual);
  const playheadDate = usePlayheadDate();
  const playheadDay = new Date(playheadDate);

  const source = framework.source;

  let allSequences = sequences.allSequences;
  if (source === "NBL") {
    // Show only NBL sequences
    allSequences = allSequences.filter((eva) => eva.displayTitle.includes("NBL"));
  } else if (source === "TEST_EVENTS") {
    // Filter out all NBL sequences
    allSequences = allSequences.filter((eva) => !eva.displayTitle.includes("NBL"));
  } else if (source === "ARTEMIS") {
    // Filter out all sequences because there's nothing to show in the dropdown for Artemis (currently)
    allSequences = [];
  }

  const today = new Date();

  // Derive year-month from playheadDate
  const playheadYearMonth = useMemo(() => {
    const date = new Date(playheadDate);
    const mm = padZeros(date.getUTCMonth() + 1, 2);
    const yyyy = date.getUTCFullYear();
    return `${yyyy}-${mm}`;
  }, [playheadDate]);

  /** Form of 'yyyy-mm' - null means use derived playheadYearMonth */
  const [overrideYearMonth, setOverrideYearMonth] = useState<string | null>(null);

  // Use override if set for current playhead, otherwise use derived value
  const visibleYearMonth = overrideYearMonth ?? playheadYearMonth;

  // Reset override when user navigates back to playhead's month
  const setVisibleYearMonth = (ym: string) => {
    setOverrideYearMonth(ym === playheadYearMonth ? null : ym);
  };

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
          <span style={{ margin: "5px" }}>{framework.source === "ISS" ? "EVA (US)" : "Event"}</span>
          &nbsp;&nbsp;
          {framework.source === "ISS" && (
            <>
              <div className={`${styles.dotdiv} ${styles.aquaBkg}`}></div>
              <span style={{ margin: "5px" }}>EVA (RS)</span>
            </>
          )}
        </div>
      </div>
      <div className={styles.thinLine} />
      <DayOfYearPicker />
    </div>
  );
};
