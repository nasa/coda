import { isNil } from "lodash";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "store/index";
import { isSameDate } from "store/playhead";
import { sequencesSelector } from "store/sequences";
import { setControlStateData } from "store/viewer";
import { SequenceType } from "utils/enums";
import styles from "./eva-info.module.css";

export function EVAInfoControls() {
  return <>Here are some future buttons</>;
}

export default function EVAInfo(props: { frameID: number }) {
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);

  const frameID = props.frameID;
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setControlStateData({ frameID, controlStateData: {} }));
  }, []);

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
