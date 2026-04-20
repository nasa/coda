import isNil from "lodash/isNil";
import { FunctionComponent } from "react";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import styles from "./dropdown-event.module.css";
import { padZeros } from "utils/formatting";
import { collection as collectionEnum } from "utils/consts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { diff, isSameDate, midnightZulu } from "../../utils/date";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { usePlayheadDate } from "store/hooks";
import { useAppDispatch } from "utils/useAppDispatch";
import { thunkChangeViewingDate } from "store/thunk/clockThunk";

/**
 * Format display title for test events by adding event number in brackets
 * Example: "Test Event:757" -> "2021-10-23 TEST_EVENTS / Unknown (757)"
 */
const formatTestEventDisplayTitle = (sequence: Sequence): string => {
  const eventNumberMatch = sequence.name.match(/Test Event:(\d+)/);
  if (eventNumberMatch && eventNumberMatch[1]) {
    return `${sequence.displayTitle} (${eventNumberMatch[1]})`;
  }
  return sequence.displayTitle;
};

const EventDropdown: FunctionComponent<{
  collection: Collection;
}> = ({ collection }) => {
  const sequences: SequencesState = useAppSelector((state) => state.sequences, deepEqual);

  const date = usePlayheadDate();
  const dispatch = useAppDispatch();

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
    isSameDate(new Date(eva.startDate), new Date(date ?? ""))
  );

  const value = selectedEVA?.startDate ?? "";

  const handleEVASelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    if (e.target.value !== "") {
      const [year, month, day] = e.target.value.split("-").map(Number);
      const newDate = new Date(Date.UTC(year, month - 1, day));

      dispatch(
        thunkChangeViewingDate({
          newDate: midnightZulu(newDate).toISOString(),
          keepCurrentTime: true,
        })
      );
    }
  };

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
          value={(date ?? "").split("T")[0]}
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
          <option disabled>──────────</option>
          {Array.from({ length: 10 }, (_, i) => i).map((i) => {
            const date = new Date("2026-04-01");
            date.setDate(date.getDate() + i);
            const year = date.getFullYear();
            const month = padZeros(date.getMonth() + 1, 2);
            const day = padZeros(date.getDate(), 2);
            const formattedDate = `${year}-${month}-${day}`;
            return (
              <option key={formattedDate} value={formattedDate}>
                Artemis II - FD{padZeros(i + 1, 2)}
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
              // Data is already sorted newest to oldest from the server
              .map((eva, index) => {
                const displayText =
                  collection === collectionEnum.TEST_EVENTS
                    ? formatTestEventDisplayTitle(eva)
                    : eva.displayTitle;
                return (
                  <option key={`${eva.name}-${eva.startDate}-${index}`} value={eva.startDate}>
                    {displayText}
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
