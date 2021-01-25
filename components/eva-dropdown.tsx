import router from "next/router";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import styles from "./eva-dropdown.module.css";

export default function EVADropdown() {
  const {
    evas: { EVAs, selectedEVA },
  } = useSelector((state) => state);

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
      router.push(`/view?date=${EVAs[e.target.value].startDate}`);
    }
  };

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
        {Object.keys(EVAs).map((eva) => {
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
