import { useState, useRef } from "react";
import deepEqual from "lodash/isEqual";
import { useSelector } from "react-redux";
import { secondsToHHMMSS, shortdateFromZuluDate } from "utils/formatting";
import styles from "./header-share.module.css";
import Modal from "react-modal";
import { RootState } from "store/index";
import { VideosState } from "store/videos";
import { PlayheadState } from "store/playhead";

export default function HeaderShare() {
  const { playhead, videos }: { playhead: PlayheadState; videos: VideosState } = useSelector(
    (state: RootState) => state,
    deepEqual
  );

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
    const missionDate = shortdateFromZuluDate(dt);
    const missionTime = secondsToHHMMSS(playhead.seconds);

    const urlRoot = location.origin + location.pathname;
    let URL = `${urlRoot}?date=${missionDate}`;
    URL += `&gmt=${missionTime}`;
    URL += `&video1=${videos.downlinks[1] + 1}`;
    URL += `&video2=${videos.downlinks[2] + 1}`;

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
