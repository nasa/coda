import { isNil, get } from "lodash";
import { useSelector } from "react-redux";
import { RootState } from "store/index";
import { isSameDate } from "store/playhead";
import {
  sequencesSelector,
  getAsPerformedMissionTime,
  getSequenceStartMilliseconds,
} from "store/sequences";
import { SequenceType } from "utils/enums";
import { hhmmssFromSeconds } from "utils/formatting";
import styles from "./eva-info.module.css";

export function EVAInfoControls() {
  return <></>;
}

export default function EVAInfo() {
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);

  const allSequences = sequencesSelector.selectAll(sequences);
  const seq = allSequences.find((seq) =>
    isSameDate(new Date(seq.startDate), new Date(playhead.date))
  );

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
      response.push(
        <div
          key={asPerformed[evNum][i].startTimeSeconds}
          style={{ flex: "auto", display: "flex", flexDirection: "row" }}
        >
          <div style={{ paddingRight: "5px" }}>
            {hhmmssFromSeconds(asPerformed[evNum][i].startTimeSeconds)}:
          </div>
          <div style={{ whiteSpace: "pre-wrap", textAlign: "left" }}>
            {asPerformed[evNum][i].content}
          </div>
        </div>
      );
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
                <td colSpan={2}>
                  {seq.name} - {seq.displayTitle}
                </td>
              </tr>
              <tr>
                <td>Timing:</td>
                <td>
                  <span className={styles.labelValue}>PET Start:</span>
                  {seq.startTime}Z
                </td>
                <td>
                  <span className={styles.labelValue}>Duration:</span> {seq.duration / 60} min
                </td>
              </tr>
            </tbody>
          </table>
          <table className={styles.dataTable}>
            <tbody>
              <tr>
                <td colSpan={2} style={{ textAlign: "center" }}>
                  Timeline
                </td>
              </tr>
              <tr>
                <th style={{ textAlign: "center", width: "50%" }}>EV1: {seq.crew.EV1}</th>
                <th style={{ textAlign: "center", width: "50%" }}>EV2: {seq.crew.EV2}</th>
              </tr>
              <tr>
                <td style={{ textAlign: "center", width: "50%" }}>{asExecutedTable("EV1")}</td>
                <td style={{ textAlign: "center", width: "50%" }} className={styles.labelValue}>
                  {asExecutedTable("EV2")}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        <>No EVA today</>
      )}
    </div>
  );
}
