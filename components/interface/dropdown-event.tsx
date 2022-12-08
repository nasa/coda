import get from "lodash/get";
import isNil from "lodash/isNil";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "store/index";
import { diff, isSameDate } from "store/playhead";
import styles from "./dropdown-event.module.css";
import { padZeros } from "utils/formatting";
import { Collection } from "utils/enums";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { generateShareURL } from "utils/share-state";

export default function EventDropdown(props: {
  collection: Collection;
  setHelpLoaderOpen: Function;
}) {
  const sequences: SequencesState = useSelector((state: RootState) => state.sequences);
  const date = useSelector((state: RootState) => state.playhead.date);
  const framework = useSelector((state: RootState) => state.framework);
  const playhead = useSelector((state: RootState) => state.playhead);

  let allSequences = sequences.allSequences;
  if (props.collection === Collection.NBL) {
    // Show only NBL sequences
    allSequences = allSequences.filter((eva) => eva.displayTitle.includes("NBL"));
  } else if (props.collection === Collection.TEST_EVENTS) {
    // Filter out all NBL sequences
    allSequences = allSequences.filter((eva) => !eva.displayTitle.includes("NBL"));
  } else if (props.collection === Collection.ARTEMIS) {
    // Filter out all sequences because there's nothing to show in the dropdown for Artemis (currently)
    allSequences = [];
  }

  const selectedEVA = allSequences.find((eva) =>
    isSameDate(new Date(eva.startDate), new Date(date))
  );
  const evaName = get(selectedEVA, "name", "");

  const [value, setValue] = useState("");
  useEffect(() => setValue(get(selectedEVA, "startDate", "")), [evaName]);

  /**
   * Navigate to another Event
   */
  const handleEVASelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setValue(e.target.value);
    if (e.target.value !== "") {
      const [year, month, day] = e.target.value.split("-");
      const formattedDate = `${year}-${padZeros(+month, 2)}-${padZeros(+day, 2)}`;
      let URL = generateShareURL(framework, playhead);
      // replace the datestring in URL with selected calendar date
      URL = URL.replace(/\d{4}-\d{2}-\d{2}/, formattedDate);
      window.location.assign(URL);
    }
  };

  // TODO: add ... to avoid going behind the arrow

  const today = new Date();
  const earliestCutoff = new Date("2013-03-30");

  let selectText = "";
  if (props.collection === Collection.ISS) {
    selectText = "Select EVA";
  } else if (props.collection === Collection.NBL) {
    selectText = "Select NBL Run";
  } else if (props.collection === Collection.TEST_EVENTS) {
    selectText = "Select Test Event";
  } else if (props.collection === Collection.ARTEMIS) {
    selectText = "Select Mission Date";
  }

  if (props.collection === Collection.ARTEMIS) {
    // Create a dropdown of just dates for Artemis 1. There's no Wiki source for this.
    return (
      <div className={styles.select}>
        <select
          name="EVAsDropdown"
          id="EVAsDropdown"
          onChange={handleEVASelect}
          value={date.split("T")[0]}
        >
          <option key="" value="">
            {selectText}
          </option>
          {Array.from({ length: 27 }, (_, i) => i).map((i) => {
            const date = new Date("2022-11-16");
            date.setDate(date.getDate() + i);
            const year = date.getFullYear();
            const month = padZeros(date.getMonth() + 1, 2);
            const day = padZeros(date.getDate(), 2);
            const formattedDate = `${year}-${month}-${day}`;
            return (
              <option key={formattedDate} value={formattedDate}>
                Artemis I - FD{padZeros(i + 1, 2)}
              </option>
            );
          })}
        </select>
        <div className={styles.select_arrow}>
          <FontAwesomeIcon icon="chevron-down" />
        </div>
      </div>
    );
  } else {
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
}
