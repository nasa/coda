import { useState, useRef } from "react";
import { useSelector, useStore } from "react-redux";
import { getApplicationUTC } from "store/clock";
import { timeFromZuluDate } from "utils/formatting";
import styles from "./header-share.module.css";
import Modal from "react-modal";

export default function HeaderShare() {
  const store = useStore();
  const {
    evas: { EVAs, selectedEVA },
  } = useSelector((state) => state);

  const { clock } = store.getState();
  const EVADate = EVAs[selectedEVA].startDate;

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

    const utc = getApplicationUTC(clock);
    const dt = new Date(utc);
    const missionTime = timeFromZuluDate(dt);

    const urlRoot = document.URL.substr(0, document.URL.lastIndexOf("?"));
    const URL = urlRoot + "?date=" + EVADate + "&GMT=" + missionTime;

    // "&v0=" + gSelectedVidGroup[0] + "&v1=" + gSelectedVidGroup[1];

    setShareURLtextValue(URL);

    setIsOpen(true);
  }

  function handleRequestClose() {
    setIsOpen(false);
    // console.log("handleRequestClose()");
  }

  return (
    <>
      <div
        style={{
          backgroundColor: "#2b2a2d",
          padding: "15px",
        }}
        onClick={(e) => {
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
        <div className={styles.modalHeadline}>Share this EVA time</div>
        <div className={styles.modalBody}>
          <textarea
            ref={shareURLtextarea}
            className={styles.modalTextarea}
            value={shareURLtextValue}
            readOnly
          />
          <div className={styles.modalButton} onClick={handleCopyToClipboard}>
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
