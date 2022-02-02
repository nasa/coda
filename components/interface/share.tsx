import { useState, useRef } from "react";
import { useSelector } from "react-redux";
import { hhmmssFromSeconds, shortdateFromDateString } from "utils/formatting";
import styles from "./share.module.css";
import Modal from "react-modal";
import { RootState } from "store/index";
import { PaneTypeShortVal } from "utils/enums";

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

  async function handleRequestOpen() {
    setCopyButtonText("Copy Link");

    const dt = new Date(playhead.date);

    const missionDate = shortdateFromDateString(dt.toISOString());
    const missionTime = hhmmssFromSeconds(playhead.seconds);

    // const jsonurlLzma = jsonurl("lzma");
    // const compressedFrameworkState = await jsonurlLzma.compress(framework);

    const layout = framework.layout;
    const source = framework.source;

    let i = 1;
    let stateUrlParams = "";
    for (const [_key, element] of Object.entries(framework.frames)) {
      let paneStateString = "";
      switch (element.paneType) {
        case "video_downlink":
          paneStateString = getStateStringForVideo(
            element.paneStateData,
            PaneTypeShortVal.video_downlink
          );
          break;
        case "video_non_downlink":
          paneStateString = getStateStringForVideo(
            element.paneStateData,
            PaneTypeShortVal.video_non_downlink
          );
          break;
        case "photo":
          paneStateString = getStateStringForPhoto(element.paneStateData);
          break;
        case "event_info":
          paneStateString = getStateStringForEventInfo();
          break;
        case "iss_position":
          paneStateString = getStateStringforISSLocation(element.paneStateData);
          break;
      }
      stateUrlParams += "&f" + i + "=" + paneStateString;
      i++;
    }

    function getStateStringForVideo(state: VideoPaneStateData, paneType: PaneTypeShortVal) {
      const paneTypeString = "0" + paneType;
      const dlString = state.downlink === -1 ? "-1" : "0" + state.downlink.toString();
      const mutedString = state.muted ? "1" : "0";
      return `${paneTypeString}${dlString}${mutedString}${state.activeVideoFileID}`;
    }

    function getStateStringForPhoto(state: PhotoPaneStateData) {
      const paneTypeString = "0" + PaneTypeShortVal.photo;
      const showInfo = state.showInfo ? "1" : "0";
      const showFilter = state.showFilter ? "1" : "0";
      return `${paneTypeString}${showInfo}${showFilter}`;
    }

    function getStateStringForEventInfo() {
      const paneTypeString = "0" + PaneTypeShortVal.event_info;
      return `${paneTypeString}`;
    }

    function getStateStringforISSLocation(state: LocationPaneStateData) {
      const paneTypeString = "0" + PaneTypeShortVal.iss_position;
      const lockToggle = state.lockToggle ? "1" : "0";
      return `${paneTypeString}${lockToggle}`;
    }

    // const compressedStateParams = await jsonurlLzma.compress(stateUrlParams);

    const urlRoot = location.origin + location.pathname;
    let URL = `${urlRoot}?date=${missionDate}`;
    URL += `&gmt=${missionTime}`;
    URL += `&l=${layout}`;
    URL += `&s=${source}`;
    URL += stateUrlParams;
    // URL += `&state=${compressedFrameworkState}`;
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
