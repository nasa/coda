import { FunctionComponent } from "react";
import { retryTalkybot } from "store/talkybot";
import { getTalkybotBaseUrl, getTalkybotSetupError } from "utils/talkybot";
import { useAppDispatch } from "utils/useAppDispatch";
import { refEqual, useAppSelector } from "utils/useAppSelector";
import styles from "./talkybotConnectionNotice.module.css";

const TalkybotConnectionNotice: FunctionComponent = () => {
  const dispatch = useAppDispatch();
  const fetchFailed = useAppSelector(
    (state) => state.talkybot.metadata?.success === false,
    refEqual
  );
  const connectionError = useAppSelector((state) => state.talkybot.connectionError, refEqual);
  const baseUrl = getTalkybotBaseUrl();
  if (!baseUrl) return null;
  const setupError = getTalkybotSetupError(window.location.href);
  if (!setupError && !fetchFailed && !connectionError) return null;

  return (
    <div className={styles.connectionNotice} role="status">
      <span>
        {setupError || (fetchFailed ? "Unable to load Talkybot communications." : connectionError)}
      </span>
      {!setupError && (
        <>
          <a href={`${baseUrl}/login`} target="_blank" rel="noopener noreferrer">
            Sign in to Talkybot
          </a>
          <button type="button" onClick={() => dispatch(retryTalkybot())}>
            Retry connection
          </button>
        </>
      )}
    </div>
  );
};

export default TalkybotConnectionNotice;
