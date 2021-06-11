import get from "lodash/get";
import isNil from "lodash/isNil";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "store/index";
import { diff } from "store/playhead";
import styles from "./dropdown.module.css";
import { idFromDate, SequencesEntityState, sequencesSelector } from "store/sequences";
import { padZeros } from "utils/formatting";

export default function RYDropdown() {
  const evas: SequencesEntityState = useSelector((state: RootState) => state.sequences);

  const date = useSelector((state: RootState) => state.playhead.date);

  const allEVAs = sequencesSelector.selectAll(evas);
  const selectedEVA = allEVAs.find((eva) => eva.startDate === idFromDate(date));
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
      window.location.assign(`${window.location.pathname}?date=${formattedDate}&sstart=true`);
    }
  };

  // TODO: maybe combine test events that are on the same day?

  const today = new Date();

  return (
    <div className={styles.select}>
      <select name="EVAsDropdown" id="EVAsDropdown" onChange={handleEVASelect} value={value}>
        {isNil(selectedEVA) ? (
          <option key="" value="">
            Jump to an event
          </option>
        ) : (
          <option disabled>Choose event</option>
        )}
        {isNil(allEVAs) ? (
          <option disabled>Loading...</option>
        ) : (
          allEVAs
            .filter((eva) => {
              // don't show future EVAs
              const [year, month, day] = eva.startDate.split("-").map(Number);
              const dateOfEVA = new Date(Date.UTC(year, month - 1, day));
              return diff(today, dateOfEVA) > 0;
            })
            // sort most recent to oldest
            .reverse()
            .map((eva) => {
              return (
                <option key={eva.name} value={eva.startDate}>
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
