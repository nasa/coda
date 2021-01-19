import router from "next/router";
import { useSelector } from "react-redux";
import styles from "./eva-dropdown.module.css";

export default function EVADropdown() {
  const {
    evas: { EVAs, selectedEVA },
  } = useSelector((state) => state);

  /**
   * Navigate to another EVA
   */
  const handleEVASelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    router.push(`/replay/${e.target.value}`);
  };

  return (
    <div className={styles.select}>
      <select name="EVAsDropdown" id="EVAsDropdown" onChange={handleEVASelect} value={selectedEVA}>
        <option disabled>Choose EVA</option>
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
