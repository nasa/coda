import { useRouter } from "next/router";
import deepEqual from "lodash/isEqual";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "store/index";
import { diff } from "store/playhead";
import styles from "./eva-dropdown.module.css";

export default function EVADropdown() {
  const router = useRouter();
  const {
    evas: { EVAs, selectedEVA },
  } = useSelector((state: RootState) => state, deepEqual);

  const [value, setValue] = useState(selectedEVA);

  useEffect(() => {
    setValue(selectedEVA);
  }, [selectedEVA]);

  /**
   * Navigate to another EVA
   */
  const handleEVASelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setValue(e.target.value);
    if (e.target.value !== "") {
      const [year, month, day] = EVAs[e.target.value].startDate.split("/");
      router.push(`/view?date=${year}-${month}-${day}`, "", { shallow: true });
    }
  };

  const today = new Date();

  return (
    <div className={styles.select}>
      <select name="EVAsDropdown" id="EVAsDropdown" onChange={handleEVASelect} value={value}>
        {selectedEVA === "" ? (
          <option key="" value="">
            Jump to an EVA
          </option>
        ) : (
          <option disabled>Choose EVA</option>
        )}
        {Object.keys(EVAs)
          .filter((eva) => {
            // don't show future EVAs
            try {
              // using the try-catch in case the wiki data is bad
              const [year, month, day] = EVAs[eva].startDate.split("/").map(Number);
              const dateOfEVA = new Date(Date.UTC(year, month - 1, day));
              return diff(today, dateOfEVA) > 0;
            } catch (e) {
              return true;
            }
          })
          // sort most recent to oldest
          .reverse()
          .map((eva) => {
            return (
              <option key={eva} value={eva}>
                {EVAs[eva].name} - {EVAs[eva].displayTitle}
              </option>
            );
          })}
      </select>
      <div className={styles.select_arrow}></div>
    </div>
  );
}
