import { useState, useRef, useEffect, JSX } from "react";
import styles from "./share.module.css";
import { generateShareURL } from "utils/share-state";
import { getDockviewApi } from "components/framework/dockview/dockview-api-ref";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { usePlayheadDate } from "store/hooks";
import { HelpButton } from "./pane-help-control-button";
import HelpOverlay from "./pane-help-overlay";

const SharePanel = ({
  closeClick,
  display = false,
}: {
  closeClick?: () => void;
  display?: boolean;
}): JSX.Element => {
  const framework = useAppSelector((state) => state.framework, deepEqual);
  const clockState = useAppSelector((state) => state.clock, deepEqual);

  const [helpOpen, setHelpOpen] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState("COPY LINK");
  const [shareURLtextValue, setShareURLtextValue] = useState("");

  const playheadDate = usePlayheadDate();

  const shareURLtextarea = useRef<HTMLTextAreaElement>(null);

  function handleRequestOpen() {
    setCopyButtonText("Copy Link");

    // Compute current app seconds from clock state (same logic as ClockInterval)
    let currentAppSeconds = clockState.appSecondsAtStartStop;
    if (clockState.startStopTimestamp) {
      const secondsSinceStarted = (Date.now() - Date.parse(clockState.startStopTimestamp)) / 1000;
      currentAppSeconds = Math.floor(clockState.appSecondsAtStartStop + secondsSinceStarted);
      // Cap at 86401 to prevent race conditions while allowing day rollover at 86400
      currentAppSeconds = Math.min(currentAppSeconds, 86401);
    }

    const api = getDockviewApi();
    if (!api) return;
    const URL = generateShareURL(framework, playheadDate, currentAppSeconds, api);
    setShareURLtextValue(URL);
  }

  function handleCopyToClipboard(e: React.MouseEvent<HTMLButtonElement>) {
    shareURLtextarea.current?.select();
    // navigator.clipboard.writeText(shareURLtextarea.current.value);
    document.execCommand("copy");
    (e.target as HTMLButtonElement).focus();
    setCopyButtonText("Link Copied");
  }

  useEffect(() => {
    /** when modal opened, regenerate the share URL */
    if (display) {
      handleRequestOpen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleRequestOpen uses frequently-changing appSeconds; only regenerate when modal opens
  }, [display]);

  return (
    <div className={styles.main}>
      <div className={styles.top}>
        <div className={styles.topLeft}>
          <div>Share this View of Playback Time</div>
        </div>
        <div className={styles.topRight}>
          <div className={styles.verticalCenter}>
            <HelpButton
              clickHandler={() => {
                setHelpOpen(!helpOpen);
              }}
            />
          </div>
          {closeClick && (
            <div className={styles.close} onClick={closeClick}>
              ✕
            </div>
          )}
        </div>
      </div>
      <div className={styles.presets}>
        <div className={styles.body}>
          <p>
            This link will open CODA at the currently displayed mission time, restoring the data
            source, frame layout, selected applications, and application settings to their current
            state.
          </p>
          <textarea
            ref={shareURLtextarea}
            className={styles.textarea}
            value={shareURLtextValue}
            readOnly
          />
          <div className={styles.verticalCenter} style={{ float: "right" }}>
            <button
              className={styles.button}
              style={{ width: "120px" }}
              onClick={handleCopyToClipboard}
            >
              <span className={styles.buttonLabel}>{copyButtonText}</span>
            </button>
          </div>
        </div>
      </div>
      <HelpOverlay
        isModalOpen={helpOpen}
        closeHandler={() => {
          setHelpOpen(false);
        }}
      >
        <div>
          <p>
            CODA Share links can be used to displaying exact moments via the currently selected CODA
            display configuration.
          </p>
          <p>
            Include these links in the Wiki, anomaly reports, or other documents that could benefit
            from precisely referencing an incident or activity in context.
          </p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default SharePanel;
