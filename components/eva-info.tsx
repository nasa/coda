import { isNil } from "lodash";
import { useSelector } from "react-redux";
import { RootState } from "store/index";
import { isSameDate, PlayheadState } from "store/playhead";
import { SequencesEntityState, sequencesSelector } from "store/sequences";
import { SequenceType } from "typings";
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

  return (
    <div className={styles.main}>
      {!isNil(seq) && seq.type === SequenceType.EVA ? (
        <div>
          <div>
            EV1:{" "}
            <span style={{ color: "white" }} id="ev1TitleSpan">
              {seq.crew?.EV1 || "unknown"}
            </span>
          </div>
          <div>
            EV2:{" "}
            <span style={{ color: "white" }} id="ev2TitleSpan">
              {seq.crew?.EV2 || "unknown"}
            </span>
          </div>
        </div>
      ) : (
        <>No EVA today</>
      )}
    </div>
  );
}
