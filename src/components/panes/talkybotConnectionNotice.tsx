import { FunctionComponent } from "react";
import { retryTalkybot } from "store/talkybot";
import { useAppDispatch } from "utils/useAppDispatch";
import { refEqual, useAppSelector } from "utils/useAppSelector";
import styles from "./talkybotConnectionNotice.module.css";

const TalkybotConnectionNotice: FunctionComponent = () => {
  const dispatch = useAppDispatch();
  const metadata = useAppSelector((state) => state.talkybot.metadata, refEqual);
  if (metadata?.success !== false) return null;

  return (
    <div className={styles.connectionNotice} role="status">
      <span>{metadata.error || "Unable to load Talkybot communications."}</span>
      <button type="button" onClick={() => dispatch(retryTalkybot())}>
        Retry connection
      </button>
    </div>
  );
};

export default TalkybotConnectionNotice;
