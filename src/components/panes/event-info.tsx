import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import isNil from "lodash/isNil";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { usePlayheadDate } from "store/hooks";
import { useAppDispatch } from "utils/useAppDispatch";
import { setPaneStateDataValue } from "store/framework";
import { getAsPerformedMissionTime, getSequenceStartMilliseconds } from "store/sequences";
import { sequenceType } from "utils/consts";
import { appSecondsFromDateString, hhmmFromSeconds } from "utils/formatting";
import styles from "./event-info.module.css";
import { FunctionComponent, useState } from "react";
import { isSameDate } from "../../utils/date";
import { setAppSeconds } from "store/clock";
import ClockInterval from "components/framework/ClockInterval";

export const EventInfoControls: FunctionComponent<{ paneInstanceId: number }> = ({
  paneInstanceId,
}) => {
  const dispatch = useAppDispatch();

  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as EventPaneStateData,
    deepEqual
  );

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}></div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => {
              dispatch(
                setPaneStateDataValue({
                  paneInstanceId,
                  paneStateProperty: "showHelp",
                  paneStateValue: !paneStateData.showHelp,
                })
              );
            }}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
};

const EventInfo: FunctionComponent<{ paneInstanceId: number }> = ({ paneInstanceId }) => {
  // Clock state from Redux
  const playheadDate = usePlayheadDate();
  const playheadDateObj = new Date(playheadDate);
  const [_appSeconds, setLocalAppSeconds] = useState(0);

  const sequences: SequencesState = useAppSelector((state) => state.sequences, deepEqual);
  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as EventPaneStateData,
    deepEqual
  );

  const allSequences = sequences.allSequences;
  const seq = allSequences.find((seq) => isSameDate(new Date(seq.startDate), playheadDateObj));
  const dispatch = useAppDispatch();
  const [seqSourceName] = useState<"Wiki">("Wiki");

  function asExecutedTable(evNum: string) {
    if (!seq) return null;
    const asPerformed: { [key: string]: Activity[] } = { EV1: [], EV2: [] };
    const activityStartUTCMilliseconds = getSequenceStartMilliseconds(seq);

    if (seqSourceName == "Wiki") {
      for (const evName in seq.asPerformed) {
        if (evName.includes("EV1")) {
          asPerformed.EV1 = getAsPerformedMissionTime(
            seq.asPerformed[evName],
            seq.startDate,
            activityStartUTCMilliseconds
          );
        }
        if (evName.includes("EV2")) {
          asPerformed.EV2 = getAsPerformedMissionTime(
            seq.asPerformed[evName],
            seq.startDate,
            activityStartUTCMilliseconds
          );
        }
      }
    }
    const response = [];
    for (let i = 0; i < asPerformed[evNum].length; i++) {
      if (typeof asPerformed[evNum][i] !== undefined) {
        const color =
          asPerformed[evNum][i].color !== "#000000" ? asPerformed[evNum][i].color : "grey";
        response.push(
          <div
            key={asPerformed[evNum][i].startTimeSeconds}
            className={styles.taskContainer}
            onClick={() => {
              dispatch(setAppSeconds(asPerformed[evNum][i].startTimeSeconds ?? 0));
            }}
          >
            <div className={styles.taskTime}>
              {hhmmFromSeconds(asPerformed[evNum][i].startTimeSeconds ?? 0)}{" "}
            </div>
            <div className={styles.taskName} style={{ color: color }}>
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
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      {!isNil(seq) && (seq.type === sequenceType.EVA || seq.type === sequenceType.testing) ? (
        <>
          <table className={styles.dataTable}>
            <tbody>
              <tr>
                <td>Event:</td>
                <td className={styles.labelValue} colSpan={2}>
                  {seq.displayTitle}
                </td>
              </tr>
              <tr>
                <td>Timing:</td>
                <td>
                  <span>PET Start:</span>
                  <span
                    className={`${styles.labelValue} ${styles.leftPadded} ${styles.petValue}`}
                    onClick={() => {
                      dispatch(
                        setAppSeconds(
                          appSecondsFromDateString(`${seq.startDate}T${seq.startTime}Z`)
                        )
                      );
                    }}
                  >
                    {seq.startTime}Z
                  </span>
                </td>
                <td>
                  {seq.duration > 0 && (
                    <>
                      <span>Duration:</span>
                      <span className={`${styles.labelValue} ${styles.leftPadded}`}>
                        {hhmmFromSeconds(seq.duration)}
                      </span>
                    </>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          <table className={styles.dataTable}>
            <tbody>
              <tr>
                <th colSpan={2} style={{ textAlign: "center" }}>
                  {seqSourceName} Timeline
                </th>
              </tr>
              <tr>
                <th>
                  <>
                    <span style={{ fontWeight: 300 }}>EV1: </span>
                    <span className={styles.labelValue}>{seq.crew?.EV1}</span>
                  </>
                </th>
                <th>
                  <>
                    <span style={{ fontWeight: 300 }}>EV2: </span>
                    <span className={styles.labelValue}>{seq.crew?.EV2}</span>
                  </>
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
      <HelpOverlay
        isModalOpen={paneStateData.showHelp}
        closeHandler={() => {
          dispatch(
            setPaneStateDataValue({
              paneInstanceId,
              paneStateProperty: "showHelp",
              paneStateValue: !paneStateData.showHelp,
            })
          );
        }}
      >
        <div>
          <p>
            Displays details housed in the{" "}
            <a
              href={"https://wiki.jsc.nasa.gov/iss/index.php/Main_Page"}
              target={"_blank"}
              rel="noopener noreferrer"
            >
              ISS Wiki
            </a>{" "}
            (for ISS events) or the{" "}
            <a
              href={"https://wiki.jsc.nasa.gov/exploration/index.php/Main_Page"}
              target={"_blank"}
              rel="noopener noreferrer"
            >
              Exploration Wiki
            </a>{" "}
            (for test events).
          </p>
          <p>
            In addition to general event information, As-Executed timeline details entered into the
            Wiki for each event (
            <a
              href={
                "https://wiki.jsc.nasa.gov/iss/index.php/US_EVA_41/As-executed_Summary_Timeline"
              }
              target={"_blank"}
              rel="noopener noreferrer"
            >
              example
            </a>
            ) are displayed here. Clicking an event in the timeline table will jump to that start
            time of that item.
          </p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default EventInfo;
