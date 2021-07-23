import _ from "lodash";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { PseudoDropdown } from "components/dropdown-v2";
import { RootState } from "store/index";
import { changeDate, diff, isSameDate } from "store/playhead";
import { SequencesEntityState, sequencesSelector } from "store/sequences";
import type { Sequence } from "typings/index";
import styles from "./calendar.module.css";

const monthOnly: Intl.DateTimeFormatOptions = {
  month: "long",
  timeZone: "UTC",
};

export function MonthsModal() {}

interface DateDescription {
  date: Date;
  isToday: boolean;
  inMonth: boolean;
  isLater: boolean;
  EVA: Sequence;
}

export function CalendarDate({
  description,
  closeClick,
}: {
  description: DateDescription;
  closeClick: () => void;
}) {
  const dispatch = useDispatch();

  const classes = [styles.calendarDate];
  if (description.inMonth && !description.isLater) {
    classes.push(styles.grey);
  }

  if (description.isToday) {
    classes.push(styles.bordered);
  }

  if (!description.inMonth || description.isLater) {
    classes.push(styles.greyText);
  }

  if (!description.isLater) {
    classes.push(styles.clickable);
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!description.isLater) {
      dispatch(changeDate(description.date.toISOString()));
      closeClick();
    }
  };

  return (
    <div onClick={handleClick}>
      {!_.isNil(description.EVA) && (
        <div title={description.EVA.name} className={`${styles.dot} ${styles.orange}`}>
          •
        </div>
      )}
      <div className={classes.join(" ")}>
        <div className={styles.verticalCenter}>{description.date.getUTCDate()}</div>
      </div>
    </div>
  );
}

/** Renders a calendar */
export default function Calendar({ closeClick }: { closeClick?: () => void }) {
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const playheadDate = useSelector((state: RootState) => state.playhead.date);

  const today = new Date();
  const date = new Date(playheadDate);

  const allSequences = sequencesSelector.selectAll(sequences);

  const monthString = new Intl.DateTimeFormat("en-CODA", monthOnly).format(date);
  const yyyy = date.getUTCFullYear();
  const mm = date.getUTCMonth();
  const dd = date.getUTCDate();

  const firstOfMonth = new Date(date);
  firstOfMonth.setUTCDate(1);
  const dayOfWeek = firstOfMonth.getUTCDay();

  const datesToRender: DateDescription[] = [];
  const iterDate = new Date(firstOfMonth);
  iterDate.setUTCDate(1 - dayOfWeek);

  for (let i = 0; i < 42; i++) {
    const d = iterDate.getUTCDate();
    const inMonth = iterDate.getUTCMonth() === mm;
    const isToday = inMonth && d === dd;
    const isLater = diff(today, iterDate) < 0;

    const EVA = allSequences.find((seq) => isSameDate(new Date(seq.startDate), iterDate));

    datesToRender.push({
      date: new Date(iterDate),
      inMonth,
      isToday,
      isLater,
      EVA,
    });
    iterDate.setUTCDate(d + 1);
  }

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
          <PseudoDropdown size="medium" color="grey" modal={() => <>foo</>}>
            <>&nbsp;{monthString}</>
          </PseudoDropdown>
        </div>
        <div style={{ width: "104px", height: "29px" }}>
          <PseudoDropdown size="medium" color="grey" modal={() => <>foo</>}>
            <>&nbsp;{yyyy}</>
          </PseudoDropdown>
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
          <span className={`${styles.orange}`}>•</span> EVA &nbsp;&nbsp;
          <span className={`${styles.aqua}`}>•</span> IVA or Other Event
        </div>
        <div style={{ width: "320px", height: "40px" }}>
          <PseudoDropdown color="grey" modal={() => <>foo</>}>
            <>&nbsp;EVA Events</>
          </PseudoDropdown>
        </div>
      </div>
    </div>
  );
}
