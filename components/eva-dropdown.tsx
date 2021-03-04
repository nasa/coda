import deepEqual from "lodash/isEqual";
import get from "lodash/get";
import isNull from "lodash/isNull";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "store/index";
import { diff, PlayheadState } from "store/playhead";
import styles from "./eva-dropdown.module.css";
import { evaSelector, EVAsState } from "store/evas";
import { padZeros } from "utils/formatting";

export default function EVADropdown() {
  const router = useRouter();
  const {
    evas,
    playhead: { date },
  }: { evas: EVAsState; playhead: PlayheadState } = useSelector(
    (state: RootState) => state,
    deepEqual
  );

  const eva = evaSelector(evas, date);
  const evaName = get(eva, "name", "");
  const [value, setValue] = useState("");
  useEffect(() => setValue(get(eva, "startDate", "")), [evaName]);

  /**
   * Navigate to another EVA
   */
  const handleEVASelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setValue(e.target.value);
    if (e.target.value !== "") {
      const [year, month, day] = evas.objects[e.target.value].startDate.split("-");
      router.push(`/view?date=${year}-${padZeros(+month, 2)}-${padZeros(+day, 2)}`, "", {
        shallow: true,
      });
    }
  };

  const today = new Date();
  const evaList = Object.keys(evas.objects);

  return (
    <div className={styles.select}>
      <select name="EVAsDropdown" id="EVAsDropdown" onChange={handleEVASelect} value={value}>
        {isNull(eva) ? (
          <option key="" value="">
            Jump to an EVA
          </option>
        ) : (
          <option disabled>Choose EVA</option>
        )}
        {evaList
          .filter((evaDate) => {
            // don't show future EVAs
            const [year, month, day] = evaDate.split("-").map(Number);
            const dateOfEVA = new Date(Date.UTC(year, month - 1, day));
            return diff(today, dateOfEVA) > 0;
          })
          // sort most recent to oldest
          .reverse()
          .map((evaDate) => {
            return (
              <option key={evaDate} value={evaDate}>
                {evas.objects[evaDate].name} - {evas.objects[evaDate].displayTitle}
              </option>
            );
          })}
      </select>
      <div className={styles.select_arrow}></div>
    </div>
  );
}
