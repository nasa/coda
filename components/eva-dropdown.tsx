import get from "lodash/get";
import isNil from "lodash/isNil";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useSelector, useStore } from "react-redux";
import { RootState } from "store/index";
import { diff } from "store/playhead";
import styles from "./eva-dropdown.module.css";
import { evasSelector, idFromDate } from "store/evas";
import { padZeros } from "utils/formatting";

export default function EVADropdown() {
  const router = useRouter();
  const store = useStore();
  const date = useSelector((state: RootState) => state.playhead.date);

  const allEVAs = evasSelector.selectAll(store.getState());
  const selectedEVA = evasSelector.selectById(store.getState(), idFromDate(date));
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
      const [year, month, day] = evasSelector
        .selectById(store.getState(), e.target.value)
        .startDate.split("-");
      router.push(`/view?date=${year}-${padZeros(+month, 2)}-${padZeros(+day, 2)}`, "", {
        shallow: true,
      });
    }
  };

  const today = new Date();

  return (
    <div className={styles.select}>
      <select name="EVAsDropdown" id="EVAsDropdown" onChange={handleEVASelect} value={value}>
        {isNil(selectedEVA) ? (
          <option key="" value="">
            Jump to an EVA
          </option>
        ) : (
          <option disabled>Choose EVA</option>
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
                <option key={eva.startDate} value={eva.startDate}>
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
