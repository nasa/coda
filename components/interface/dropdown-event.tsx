import get from "lodash/get";
import isNil from "lodash/isNil";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "store/index";
import { diff, isSameDate } from "store/playhead";
import styles from "./dropdown-event.module.css";
import { sequencesSelector } from "store/sequences";
import { padZeros } from "utils/formatting";
import { Collection, Source } from "utils/enums";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function EventDropdown(props: { collection: Collection }) {
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);

  const date = useSelector((state: RootState) => state.playhead.date);

  let allSequences = sequencesSelector.selectAll(sequences);
  if (props.collection === Collection.NBL) {
    // Show only NBL sequences
    allSequences = allSequences.filter((eva) => eva.displayTitle.includes("NBL"));
  } else if (props.collection === Collection.TEST_EVENTS) {
    // Filter out all NBL sequences
    allSequences = allSequences.filter((eva) => !eva.displayTitle.includes("NBL"));
  }

  const selectedEVA = allSequences.find((eva) =>
    isSameDate(new Date(eva.startDate), new Date(date))
  );
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
      const [year, month, day] = e.target.value.split("-");
      const formattedDate = `${year}-${padZeros(+month, 2)}-${padZeros(+day, 2)}`;
      let source = Source.ISS;
      if (props.collection === Collection.NBL) {
        source = Source.NBL;
      } else if (props.collection === Collection.TEST_EVENTS) {
        source = Source.TEST_EVENTS;
      }
      window.location.assign(`${window.location.pathname}?date=${formattedDate}&s=${source}`);
    }
  };

  // TODO: add ... to avoid going behind the arrow

  const today = new Date();
  const earliestCutoff = new Date("2013-03-30");

  let selectText = "Select EVA";
  if (props.collection === Collection.NBL) {
    selectText = "Select NBL Run";
  } else if (props.collection === Collection.TEST_EVENTS) {
    selectText = "Select Test Event";
  }

  return (
    <div className={styles.select}>
      <select name="EVAsDropdown" id="EVAsDropdown" onChange={handleEVASelect} value={value}>
        {isNil(selectedEVA) ? (
          <option key="" value="">
            {selectText}
          </option>
        ) : (
          <option disabled>Select Event</option>
        )}
        {isNil(allSequences) ? (
          <option disabled>Loading...</option>
        ) : (
          allSequences
            .filter((sequence) => {
              // don't show future EVAs or EVAs before 2013-03-30 (because of IO data being unavailable before that)
              const [year, month, day] = sequence.startDate.split("-").map(Number);
              const dateOfEVA = new Date(Date.UTC(year, month - 1, day));
              return diff(today, dateOfEVA) > 0 && diff(earliestCutoff, dateOfEVA) < 0;
            })
            // sort most recent to oldest
            .reverse()
            .map((eva) => {
              return (
                <option key={eva.name + eva.startDate} value={eva.startDate}>
                  {eva.displayTitle}
                </option>
              );
            })
        )}
      </select>
      <div className={styles.select_arrow}>
        <FontAwesomeIcon icon="chevron-down" />
      </div>
    </div>
  );
}
