import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import isNil from "lodash/isNil";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { setPaneStateValue } from "store/framework";
import { RootState } from "store/index";
import { getAsPerformedMissionTime, getSequenceStartMilliseconds } from "store/sequences";
import { sequenceType } from "utils/consts";
import { appSecondsFromDateString, hhmmFromSeconds } from "utils/formatting";
import styles from "./event-info.module.css";
import { FunctionComponent, useEffect, useState } from "react";
import { isSameDate } from "../../utils/date";
import { usePlayheadContext } from "store/contextProviders/playheadContext";

export const EventInfoControls: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const dispatch = useAppDispatch();

  const paneStateData: EventPaneStateData = useAppSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}></div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => {
              setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
            }}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
};

const EventInfo: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const { playhead, setPlayhead } = usePlayheadContext();

  const sequences: SequencesState = useAppSelector(
    (state: RootState) => state.sequences,
    deepEqual
  );
  const paneStateData: EventPaneStateData = useAppSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );

  const allSequences = sequences.allSequences;
  const seq = allSequences.find((seq) =>
    isSameDate(new Date(seq.startDate), new Date(playhead.date))
  );
  const maestro = useAppSelector((state: RootState) => state.maestro, deepEqual);
  const dispatch = useAppDispatch();
  const [seqSourceName, setSeqSourceName] = useState<"Maestro" | "Wiki">("Wiki");

  useEffect(() => {
    const newSeqSourceName = maestro?.processedActivitiesData ? "Maestro" : "Wiki";
    setSeqSourceName(newSeqSourceName);
  }, [maestro]);

  function asExecutedTable(evNum: string) {
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
    } else {
      asPerformed.EV1 = maestro?.processedActivitiesData.EV1;
      asPerformed.EV2 = maestro?.processedActivitiesData.EV2;
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
              setPlayhead((prev) => ({
                ...prev,
                appSeconds: asPerformed[evNum][i].startTimeSeconds,
              }));
            }}
          >
            <div className={styles.taskTime}>
              {hhmmFromSeconds(asPerformed[evNum][i].startTimeSeconds)}{" "}
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
      {!isNil(seq) && seq.type === sequenceType.EVA ? (
        <>
          <table className={styles.dataTable}>
            <tbody>
              <tr>
                <td>Event:</td>
                <td className={styles.labelValue} colSpan={2}>
                  {seqSourceName === "Wiki" ? seq.displayTitle : maestro.title}
                </td>
              </tr>
              <tr>
                <td>Timing:</td>
                <td>
                  <span>PET Start:</span>
                  <span
                    className={`${styles.labelValue} ${styles.leftPadded} ${styles.petValue}`}
                    onClick={() => {
                      setPlayhead((prev) => ({
                        ...prev,
                        appSeconds: appSecondsFromDateString(`${seq.startDate}T${seq.startTime}Z`),
                      }));
                    }}
                  >
                    {seqSourceName === "Wiki"
                      ? seq.startTime
                      : hhmmFromSeconds(maestro.evaStartSec)}
                    Z
                  </span>
                </td>
                <td>
                  <span>Duration:</span>
                  <span className={`${styles.labelValue} ${styles.leftPadded}`}>
                    {seqSourceName === "Wiki"
                      ? hhmmFromSeconds(seq.duration)
                      : hhmmFromSeconds(maestro.evaDurationSec)}
                  </span>
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
                  {seqSourceName === "Wiki" ? (
                    <>
                      <span style={{ fontWeight: 300 }}>EV1: </span>
                      <span className={styles.labelValue}>{seq.crew.EV1}</span>
                    </>
                  ) : (
                    <span className={styles.labelValue}>{maestro.crewAssignment.EV1}</span>
                  )}
                </th>
                <th>
                  {seqSourceName === "Wiki" ? (
                    <>
                      <span style={{ fontWeight: 300 }}>EV2: </span>
                      <span className={styles.labelValue}>{seq.crew.EV2}</span>
                    </>
                  ) : (
                    <span className={styles.labelValue}>{maestro.crewAssignment.EV2}</span>
                  )}
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
          setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
        }}
      >
        <div>
          <p>
            Displays details housed in the{" "}
            <a href={"https://wiki.jsc.nasa.gov/iss/index.php/Main_Page"} target={"_blank"}>
              ISS Wiki
            </a>{" "}
            (for ISS events) or the{" "}
            <a href={"https://wiki.jsc.nasa.gov/exploration/index.php/Main_Page"} target={"_blank"}>
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
