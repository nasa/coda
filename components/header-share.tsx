import { useState, useRef } from "react";
import { useSelector, useStore } from "react-redux";
import { getApplicationUTC, getMissionTime, set } from "store/clock";
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

  function copyToClipboard(e) {
    shareURLtextarea.current.select();
    navigator.clipboard.writeText(shareURLtextarea.current.value);
    e.target.focus();
    setCopyButtonText("LINK COPIED");
  }

  function openModal() {
    setCopyButtonText("COPY LINK");

    const utc = getApplicationUTC(clock);
    const dt = new Date(utc);
    const missionTime = timeFromZuluDate(dt);

    const urlRoot = document.URL.substr(0, document.URL.lastIndexOf("/"));
    const URL = urlRoot + "?date=" + EVADate + "&GMT=" + missionTime;

    //TODO: make additional parameters for selected videos
    // "&v0=" + gSelectedVidGroup[0] + "&v1=" + gSelectedVidGroup[1];

    setShareURLtextValue(URL);

    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    // console.log("closeModal()");
  }

  return (
    <>
      <div
        className={styles.svgShare}
        onClick={(e) => {
          openModal();
        }}
      ></div>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        className={styles.shareModalWrapper}
        overlayClassName={styles.modalOverlay}
        contentLabel="Share"
      >
        <div className={styles.modalHeadline}>Share this EVA time</div>
        <div className={styles.modalBody}>
          <textarea ref={shareURLtextarea} className={styles.modalTextarea}>
            {shareURLtextValue}
          </textarea>
          <div className={styles.modalButton} onClick={copyToClipboard}>
            <div className={styles.modalButtonText}>{copyButtonText}</div>
          </div>
        </div>
        <div className={styles.closeButtonWrapper}>
          <div className={styles.closeButton} onClick={closeModal}>
            <div className={styles.closeSVG}></div>
          </div>
        </div>
      </Modal>
    </>
  );
}
