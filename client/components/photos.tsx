import deepEqual from "lodash/isEqual";
import { useEffect, useState } from "react";
import { useSelector, useDispatch, useStore } from "react-redux";
import { PlayheadState } from "store/playhead";
import { initialPhotoFileState, setActivePhoto, photosSelectors } from "store/photos";
import styles from "./photos.module.css";

import {
  appSecondsFromDateString,
  hhmmssFromDateString,
  hhmmssFromSeconds,
} from "utils/formatting";
import type { RootState } from "store/index";

export default function Photos() {
  const dispatch = useDispatch();
  const { photos, playhead }: { photos; playhead: PlayheadState } = useSelector(
    (state: RootState) => state,
    deepEqual
  );
  const [infoToggle, setInfoToggle] = useState(false);
  const [infoHover, setInfoHover] = useState(false);

  const photoFiles = photosSelectors.selectAll(useStore().getState());

  const changePhoto = () => {
    if (!photos.ready) {
      return;
    }

    /* Loop through all returned photos in order of date_taken
     * break as soon as we hit a photo that was taken after playhead.seconds leaving the data we gathered
     * on the previous photo for use.
     */
    let thisPhotoFile = initialPhotoFileState;
    for (let i = 0; i < photoFiles.length; i++) {
      const secondsIntoToday = appSecondsFromDateString(photoFiles[i].date_taken);
      if (secondsIntoToday > playhead.seconds) {
        break;
      }
      thisPhotoFile = photoFiles[i];
    }
    if (Object.keys(thisPhotoFile).length !== 0) {
      if (thisPhotoFile.lowResURL !== photos.activePhoto.lowResURL) {
        dispatch(setActivePhoto(thisPhotoFile));
      }
    }
  };

  useEffect(changePhoto, [playhead.seconds, photoFiles]);

  const renderPhotoOverlay = () => {
    const currentlyActivePhoto = photos.activePhoto.date_taken !== "";
    let ioSearchLink = "";
    let ioHighResURL = "";
    let openURLMessage = "";
    let photoFilename = "";
    let dateAdded = "";
    let dateTaken = "";
    let openOnIOMessage = "";
    let info = "";
    let infoDisplayClass = "";
    if (currentlyActivePhoto) {
      photoFilename = photos.activePhoto.id;
      ioSearchLink = photos.activePhoto.ioInfoURL;
      ioHighResURL = photos.activePhoto.highResURL;
      openURLMessage = `Open high res`;
      openOnIOMessage = `Open on IO`;
      dateAdded =
        photos.activePhoto.date_added !== ""
          ? new Date(photos.activePhoto.date_added).toUTCString()
          : "-";
      dateTaken =
        photos.activePhoto.date_taken !== ""
          ? new Date(photos.activePhoto.date_taken).toUTCString()
          : "-";

      if (infoHover || infoToggle) {
        infoDisplayClass = styles.photoOverlayVisible;
      }
    }

    return (
      <div className={`${styles.photoOverlay} ${infoDisplayClass}`}>
        <div className={styles.overlayTable}>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>Date Taken</div>
            <div className={`${styles.overlayTableCell}`}>{dateTaken}</div>
          </div>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>Date Added</div>
            <div className={`${styles.overlayTableCell}`}>{dateAdded}</div>
          </div>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>IO Asset Name</div>
            <div className={styles.overlayTableCell}>
              <a href={ioSearchLink} target="_blank" style={{ fontSize: "0.9em" }}>
                {openOnIOMessage}
              </a>
              <div className={styles.digiValue}>{photoFilename}</div>
            </div>
          </div>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>High Res</div>
            <div className={styles.overlayTableCell}>
              <a href={ioHighResURL} target="_blank" style={{ fontSize: "0.9em" }}>
                {openURLMessage}
              </a>
              <br />
              <span className={styles.digiValue} style={{ fontSize: "0.9em", color: "#BBBBBB" }}>
                {ioHighResURL}
              </span>
            </div>
          </div>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>IO Description</div>
            <div className={styles.overlayTableCell}>{info}</div>
          </div>
        </div>
      </div>
    );
  };

  let dateTakenLabel = "";
  let dateTakenValue = "";
  let timeSinceTaken = "";
  let infoButtonStyle = "";
  const currentlyActivePhoto = photos.activePhoto.date_taken !== "";
  if (currentlyActivePhoto) {
    timeSinceTaken = `(${hhmmssFromSeconds(
      Math.round(playhead.seconds - appSecondsFromDateString(photos.activePhoto.date_taken))
    )} ago)`;
    dateTakenLabel = "Taken:";
    dateTakenValue = `${hhmmssFromDateString(photos.activePhoto.date_taken)}Z`;
    infoButtonStyle = styles.infoActive;
  }
  if (infoToggle) {
    infoButtonStyle = styles.infoSelected;
  }
  return (
    <div className={styles.mediaPanel} key={`photo_viewer`}>
      <div style={{ display: "flex" }}>
        <div
          className={`${styles.infoButton} ${infoButtonStyle}`}
          title={`Click to toggle IO info`}
          onMouseEnter={() => {
            if (currentlyActivePhoto) {
              setInfoHover(true);
            }
          }}
          onMouseLeave={() => {
            setInfoHover(false);
          }}
          onClick={() => {
            if (currentlyActivePhoto) {
              setInfoToggle(!infoToggle);
            }
          }}
        >
          <div className={styles.infoText}>IO</div> <div className={styles.infoIcon}></div>
        </div>
        <div style={{ marginLeft: "auto", marginTop: "auto" }}>
          <span
            style={{ paddingRight: "5px" }}
            className={`${styles.photoHeaderText} ${styles.dimText}`}
          >
            {dateTakenLabel}
          </span>
          <span style={{ marginRight: "5px" }} className={styles.photoHeaderText}>
            {dateTakenValue}
          </span>
          <span
            style={{ marginRight: "5px" }}
            className={`${styles.photoHeaderText} ${styles.dimText}`}
          >
            {timeSinceTaken}
          </span>
        </div>
      </div>
      <div
        key={`photo_element`}
        className={`${styles.photoContainer} ${styles.photoContainer4by3}`}
      >
        <a className={styles.photoLink} href={photos.activePhoto.highResURL} target="_blank">
          <img className={styles.photo} src={photos.activePhoto.lowResURL} />
        </a>
        {renderPhotoOverlay()}
      </div>
    </div>
  );
}
