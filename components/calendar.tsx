import { useSelector } from "react-redux";
import { PseudoDropdown } from "components/dropdown-v2";
import { RootState } from "store/index";
import { isSameDate } from "store/playhead";
import { SequencesEntityState, sequencesSelector } from "store/sequences";
import styles from "./calendar.module.css";

const monthOnly: Intl.DateTimeFormatOptions = {
  month: "long",
};

export function MonthsModal() {}

interface DateDescription {
  date: number;
  isToday: boolean;
  inMonth: boolean;
  isLater: boolean;
  hasEVA: boolean;
}

export function CalendarDate({ description }: { description: DateDescription }) {
  const classes = [styles.calendarDate];
  if (description.inMonth && !description.isLater) {
    classes.push(styles.grey);
  }

  if (description.isToday) {
    classes.push(styles.bordered);
  }

  if (!description.inMonth) {
    classes.push(styles.greyText);
  }

  return (
    <div>
      {description.hasEVA && <div className={`${styles.dot} ${styles.orange}`}>•</div>}
      <div className={classes.join(" ")}>
        <div className={styles.verticalCenter}>{description.date}</div>
      </div>
    </div>
  );
}

export default function Calendar({ closeClick }: { closeClick?: () => void }) {
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const playheadDate = useSelector((state: RootState) => state.playhead.date);

  const date = new Date(playheadDate);

  const allSequences = sequencesSelector.selectAll(sequences);

  const monthString = new Intl.DateTimeFormat("en-US", monthOnly).format(date);
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
    const isLater = inMonth && d > dd;

    const seqIndex = allSequences.findIndex((seq) => isSameDate(new Date(seq.startDate), iterDate));

    datesToRender.push({
      date: d,
      inMonth,
      isToday,
      isLater,
      // hasEVA: seqIndex >= 0,
      hasEVA: true,
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
        <div style={{ width: "206px" }}>
          <PseudoDropdown size="medium" color="grey" modal={() => <>foo</>}>
            <>&nbsp;{monthString}</>
          </PseudoDropdown>
        </div>
        <div style={{ width: "104px" }}>
          <PseudoDropdown size="medium" color="grey" modal={() => <>foo</>}>
            <>&nbsp;{yyyy}</>
          </PseudoDropdown>
        </div>
      </div>
      <div className={styles.days}>
        {datesToRender.map((d) => {
          return <CalendarDate description={d} />;
        })}
      </div>
      <div className={styles.events}>
        <div className={styles.labels}>
          <span className={`${styles.orange}`}>•</span> EVA &nbsp;&nbsp;
          <span className={`${styles.aqua}`}>•</span> IVA or Other Event
        </div>
        <div style={{ width: "320px" }}>
          <PseudoDropdown color="grey" modal={() => <>foo</>}>
            <>&nbsp;EVA Events</>
          </PseudoDropdown>
        </div>
      </div>
    </div>
  );
}
