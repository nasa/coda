import { isNil, get } from "lodash";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "store/index";
import { changeTime, isSameDate } from "store/playhead";
import {
  sequencesSelector,
  getAsPerformedMissionTime,
  getSequenceStartMilliseconds,
} from "store/sequences";
import { SequenceType } from "utils/enums";
import { hhmmssFromSeconds } from "utils/formatting";
import styles from "./event-info.module.css";

export function EventInfoControls() {
  return <></>;
}

export default function EventInfo() {
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);

  const allSequences = sequencesSelector.selectAll(sequences);
  const seq = allSequences.find((seq) =>
    isSameDate(new Date(seq.startDate), new Date(playhead.date))
  );
  const dispatch = useDispatch();

  function asExecutedTable(evNum: string) {
    const asPerformed = { EV1: [], EV2: [] };
    const activityStartUTCMilliseconds = getSequenceStartMilliseconds(seq);
    const EV1 = get(seq.asPerformed, "EV1", null);
    if (!isNil(EV1)) {
      asPerformed.EV1 = getAsPerformedMissionTime(EV1, seq.startDate, activityStartUTCMilliseconds);
    }
    const EV2 = get(seq.asPerformed, "EV2", null);
    if (!isNil(EV2)) {
      asPerformed.EV2 = getAsPerformedMissionTime(EV2, seq.startDate, activityStartUTCMilliseconds);
    }
    const response = [];
    for (let i = 0; i < asPerformed.EV1.length; i++) {
      if (typeof asPerformed[evNum][i].startTimeSeconds !== undefined) {
        response.push(
          <div
            key={asPerformed[evNum][i].startTimeSeconds}
            className={styles.taskContainer}
            onClick={() => {
              dispatch(changeTime(asPerformed[evNum][i].startTimeSeconds));
            }}
          >
            <div className={styles.taskTime}>
              {hhmmssFromSeconds(asPerformed[evNum][i].startTimeSeconds)}:
            </div>
            <div className={styles.taskName} style={{ color: asPerformed[evNum][i].color }}>
              {asPerformed[evNum][i].content}
            </div>
          </div>
        );
      }
    }
    return <div style={{ display: "flex", flexDirection: "column" }}>{response}</div>;
  }

  return (
    <div className={styles.main}>
      {!isNil(seq) && seq.type === SequenceType.EVA ? (
        <>
          <table className={styles.dataTable}>
            <tbody>
              <tr>
                <td>Event:</td>
                <td className={styles.labelValue} colSpan={2}>
                  {seq.name} - {seq.displayTitle}
                </td>
              </tr>
              <tr>
                <td>Timing:</td>
                <td>
                  <span>PET Start:</span>
                  <span className={`${styles.labelValue} ${styles.leftPadded}`}>
                    {seq.startTime}Z
                  </span>
                </td>
                <td>
                  <span>Duration:</span>
                  <span className={`${styles.labelValue} ${styles.leftPadded}`}>
                    {seq.duration / 60} min
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <table className={styles.dataTable}>
            <tbody>
              <tr>
                <th colSpan={2} style={{ textAlign: "center" }}>
                  Timeline
                </th>
              </tr>
              <tr>
                <th>
                  <span style={{ fontWeight: 300 }}>EV1: </span>
                  <span className={styles.labelValue}>{seq.crew.EV1}</span>
                </th>
                <th>
                  <span style={{ fontWeight: 300 }}>EV2: </span>
                  <span className={styles.labelValue}>{seq.crew.EV2}</span>
                </th>
              </tr>
              <tr>
                <td style={{ textAlign: "center", width: "50%" }}>{asExecutedTable("EV1")}</td>
                <td style={{ textAlign: "center", width: "50%" }}>{asExecutedTable("EV2")}</td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        <>No event details in wiki</>
      )}
    </div>
  );
}
