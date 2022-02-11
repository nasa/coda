import { useState, useRef } from "react";
import styles from "./share.module.css";
import Modal from "react-modal";
import { generateShareURL } from "utils/share-state";
import { useSelector } from "react-redux";
import { RootState } from "store/index";

export default function Share() {
  const framework = useSelector((state: RootState) => state.framework);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);

  const [modalIsOpen, setIsOpen] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState("COPY LINK");
  const [shareURLtextValue, setShareURLtextValue] = useState(null);

  const shareURLtextarea = useRef(null);

  function handleCopyToClipboard(e) {
    shareURLtextarea.current.select();
    // navigator.clipboard.writeText(shareURLtextarea.current.value);
    document.execCommand("copy");
    e.target.focus();
    setCopyButtonText("Link Copied");
  }

  function handleRequestOpen() {
    setCopyButtonText("Copy Link");

    const URL = generateShareURL(framework, playhead);
    setShareURLtextValue(URL);

    setIsOpen(true);
  }

  function handleRequestClose() {
    setIsOpen(false);
  }

  return (
    <>
      <div
        className={styles.headerModalButton}
        title="Share this view of current playback time"
        onClick={() => {
          handleRequestOpen();
        }}
      >
        <div className={styles.svgShare}></div>
      </div>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={handleRequestClose}
        className={styles.shareModalWrapper}
        overlayClassName={styles.modalOverlay}
        contentLabel="Share"
        ariaHideApp={false}
      >
        <div className={styles.modalHeadline}>Share this View of Current Playback Time</div>
        <div className={styles.modalBody}>
          <div className={styles.modalBodyText}>
            This link will open CODA at the currently displayed mission time.
            <br />
            The data source, window layout, selected displays, and selections within those displays
            will be preserved.
          </div>

          <textarea
            ref={shareURLtextarea}
            className={styles.modalTextarea}
            value={shareURLtextValue}
            readOnly
          />
          <div className={styles.copyURLButton} onClick={handleCopyToClipboard}>
            <div className={styles.modalButtonText}>{copyButtonText}</div>
          </div>
        </div>
        <div className={styles.closeButtonWrapper}>
          <div className={styles.closeButton} onClick={handleRequestClose}>
            <div className={styles.closeSVG}></div>
          </div>
        </div>
      </Modal>
    </>
  );
}
