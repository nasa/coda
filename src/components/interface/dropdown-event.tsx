import isNil from "lodash/isNil";
import { FunctionComponent } from "react";
import { deepEqual, refEqual, shallowEqual, useAppSelector } from "utils/useAppSelector";
import styles from "./dropdown-event.module.css";
import { padZeros } from "utils/formatting";
import { collection as collectionEnum } from "utils/consts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { generateShareURL } from "utils/share-state";
import { diff, isSameDate } from "../../utils/date";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

const EventDropdown: FunctionComponent<{
  collection: Collection;
}> = ({ collection }) => {
  const sequences: SequencesState = useAppSelector((state) => state.sequences, deepEqual);
  const framework = useAppSelector((state) => state.framework, shallowEqual);

  const date = useAppSelector((state) => state.clock.date, refEqual);
  const appSeconds = useAppSelector((state) => state.clock.appSecondsAtStartStop, refEqual);

  let allSequences = sequences.allSequences;
  if (collection === collectionEnum.NBL) {
    // Show only NBL sequences
    allSequences = allSequences.filter((eva) => eva.displayTitle.includes("NBL"));
  } else if (collection === collectionEnum.TEST_EVENTS) {
    // Filter out all NBL sequences
    allSequences = allSequences.filter((eva) => !eva.displayTitle.includes("NBL"));
  } else if (collection === collectionEnum.ARTEMIS) {
    // Filter out all sequences because there's nothing to show in the dropdown for Artemis (currently)
    allSequences = [];
  }

  const selectedEVA = allSequences.find((eva) =>
    isSameDate(new Date(eva.startDate), new Date(date))
  );

  const value = selectedEVA?.startDate ?? "";

  /**
   * Navigate to another Event
   */
  const handleEVASelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    if (e.target.value !== "") {
      const [year, month, day] = e.target.value.split("-");
      const formattedDate = `${year}-${padZeros(+month, 2)}-${padZeros(+day, 2)}`;
      let URL = generateShareURL(framework, date, appSeconds);
      // replace the datestring in URL with selected calendar date
      URL = URL.replace(/\d{4}-\d{2}-\d{2}/, formattedDate);
      window.location.assign(URL);
    }
  };

  // TODO: add ... to avoid going behind the arrow

  const today = new Date();
  const earliestCutoff = new Date("2013-03-30");

  let selectText = "";
  if (collection === collectionEnum.ISS) {
    selectText = "Select EVA";
  } else if (collection === collectionEnum.NBL) {
    selectText = "Select NBL Run";
  } else if (collection === collectionEnum.TEST_EVENTS) {
    selectText = "Select Test Event";
  } else if (collection === collectionEnum.ARTEMIS) {
    selectText = "Select Mission Date";
  }

  if (collection === collectionEnum.ARTEMIS) {
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
          <FontAwesomeIcon icon={faChevronDown} />
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
              .map((eva, index) => {
                return (
                  <option key={`${eva.name}-${eva.startDate}-${index}`} value={eva.startDate}>
                    {eva.displayTitle}
                  </option>
                );
              })
          )}
        </select>
        <div className={styles.select_arrow}>
          <FontAwesomeIcon icon={faChevronDown} />
        </div>
      </div>
    );
  }
};

export default EventDropdown;
