import { useState, useRef } from "react";
import { useSelector } from "react-redux";
import { hhmmssFromSeconds, shortdateFromDateString } from "utils/formatting";
import styles from "./share.module.css";
import Modal from "react-modal";
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
    setCopyButtonText("LINK COPIED");
  }

  function handleRequestOpen() {
    setCopyButtonText("COPY LINK");

    const dt = new Date(playhead.date);
    const missionDate = shortdateFromDateString(dt.toISOString());
    const missionTime = hhmmssFromSeconds(playhead.seconds);

    const source = framework.selectedSource;
    const layout = framework.layout;
    const frames = framework.frames;

    const urlRoot = location.origin + location.pathname;
    let URL = `${urlRoot}?date=${missionDate}`;
    URL += `&gmt=${missionTime}`;
    // URL += `&video1=${videos.downlinks[1] + 1}`;
    // URL += `&video2=${videos.downlinks[2] + 1}`;
    // if (videos.nonDownlinkIDs[1] !== "") {
    //   URL += `&nonDLvideo1=${videos.nonDownlinkIDs[1]}`;
    // }
    // if (videos.nonDownlinkIDs[2] !== "") {
    //   URL += `&nonDLvideo2=${videos.nonDownlinkIDs[2]}`;
    // }

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
        title="Share this moment"
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
        <div className={styles.modalHeadline}>Share This Time</div>
        <div className={styles.modalBody}>
          <div className={styles.modalBodyText}>
            This link will open CODA at the currently displayed mission time events.
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
