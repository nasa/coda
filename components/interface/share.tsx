import { useState, useRef, useEffect } from "react";
import styles from "./share.module.css";
import { generateShareURL } from "utils/share-state";
import { useSelector } from "react-redux";
import { RootState } from "store/index";
import { HelpButton } from "./pane-help-control-button";
import HelpOverlay from "./pane-help-overlay";

export default function SharePanel({
  closeClick,
  display,
}: {
  closeClick?: () => void;
  display: boolean;
}) {
  const framework = useSelector((state: RootState) => state.framework);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);

  const [helpOpen, setHelpOpen] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState("COPY LINK");
  const [shareURLtextValue, setShareURLtextValue] = useState(null);

  const shareURLtextarea = useRef(null);

  function handleRequestOpen() {
    setCopyButtonText("Copy Link");

    const URL = generateShareURL(framework, playhead);
    setShareURLtextValue(URL);
  }

  function handleCopyToClipboard(e) {
    shareURLtextarea.current.select();
    // navigator.clipboard.writeText(shareURLtextarea.current.value);
    document.execCommand("copy");
    e.target.focus();
    setCopyButtonText("Link Copied");
  }

  useEffect(() => {
    /** when modal opened, regenerate the share URL */
    if (display) {
      handleRequestOpen();
    }
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
}
