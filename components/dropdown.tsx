import get from "lodash/get";
import isNil from "lodash/isNil";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "store/index";
import { diff, isSameDate } from "store/playhead";
import styles from "./dropdown.module.css";
import { SequencesEntityState, sequencesSelector } from "store/sequences";
import { padZeros } from "utils/formatting";
import { Collection } from "typings";

export default function EVADropdown(props: { collection: Collection }) {
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);

  const date = useSelector((state: RootState) => state.playhead.date);

  let allEVAs = sequencesSelector.selectAll(sequences);
  if (props.collection === Collection.NBL) {
    // Show only NBL sequences
    allEVAs = allEVAs.filter((eva) => eva.displayTitle.includes("NBL"));
  } else if (props.collection === Collection.TEST_EVENTS) {
    // Filter out all NBL sequences
    allEVAs = allEVAs.filter((eva) => !eva.displayTitle.includes("NBL"));
  }

  const selectedEVA = allEVAs.find((eva) => isSameDate(new Date(eva.startDate), new Date(date)));
  const evaName = get(selectedEVA, "name", "");

  const [value, setValue] = useState("");
  useEffect(() => setValue(get(selectedEVA, "startDate", "")), [evaName]);

  /**
   * Navigate to another EVA
   */
  const handleEVASelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setValue(e.target.value);
    if (e.target.value !== "") {
      const eva = allEVAs.find((eva) => eva.startDate === e.target.value);
      const [year, month, day] = eva.startDate.split("-");
      const formattedDate = `${year}-${padZeros(+month, 2)}-${padZeros(+day, 2)}`;
      window.location.assign(`${window.location.pathname}?date=${formattedDate}`);
    }
  };

  // TODO: add ... to avoid going behind the arrow

  const today = new Date();
  const earliestCutoff = new Date("2013-03-30");

  return (
    <div className={styles.select}>
      <select name="EVAsDropdown" id="EVAsDropdown" onChange={handleEVASelect} value={value}>
        {isNil(selectedEVA) ? (
          <option key="" value="">
            Jump to an Event
          </option>
        ) : (
          <option disabled>Choose Event</option>
        )}
        {isNil(allEVAs) ? (
          <option disabled>Loading...</option>
        ) : (
          allEVAs
            .filter((eva) => {
              // don't show future EVAs or EVAs before 2013-03-30 (because of IO data being unavailable before that)
              const [year, month, day] = eva.startDate.split("-").map(Number);
              const dateOfEVA = new Date(Date.UTC(year, month - 1, day));
              return diff(today, dateOfEVA) > 0 && diff(earliestCutoff, dateOfEVA) < 0;
            })
            // sort most recent to oldest
            .reverse()
            .map((eva) => {
              return (
                <option key={eva.name + eva.startDate} value={eva.startDate}>
                  {eva.name} - {eva.displayTitle}
                </option>
              );
            })
        )}
      </select>
      <div className={styles.select_arrow}></div>
    </div>
  );
}
