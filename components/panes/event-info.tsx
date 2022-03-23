import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { isNil, get } from "lodash";
import { useDispatch, useSelector } from "react-redux";
import { setPaneStateValue } from "store/framework";
import { RootState } from "store/index";
import { changeTime, isSameDate } from "store/playhead";
import {
  sequencesSelector,
  getAsPerformedMissionTime,
  getSequenceStartMilliseconds,
} from "store/sequences";
import { SequenceType } from "utils/enums";
import { appSecondsFromDateString, hhmmssFromSeconds } from "utils/formatting";
import styles from "./event-info.module.css";

export function EventInfoControls(props: { frameID: number }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const paneStateData: EventPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
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
}

export default function EventInfo(props: { frameID: number }) {
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const paneStateData: EventPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

  const allSequences = sequencesSelector.selectAll(sequences);
  const seq = allSequences.find((seq) =>
    isSameDate(new Date(seq.startDate), new Date(playhead.date))
  );
  const frameID = props.frameID;
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
    for (let i = 0; i < asPerformed[evNum].length; i++) {
      if (typeof asPerformed[evNum][i] !== undefined) {
        const color =
          asPerformed[evNum][i].color !== "#000000" ? asPerformed[evNum][i].color : "grey";
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
      {!isNil(seq) && seq.type === SequenceType.EVA ? (
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
                        changeTime(appSecondsFromDateString(`${seq.startDate}T${seq.startTime}Z`))
                      );
                    }}
                  >
                    {seq.startTime}Z
                  </span>
                </td>
                <td>
                  <span>Duration:</span>
                  <span className={`${styles.labelValue} ${styles.leftPadded}`}>
                    {hhmmssFromSeconds(seq.duration)}
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
}
