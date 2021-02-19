import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ClockState } from "store/clock";
import { PhotosState, initialPhotoFileState, selectPhotoFiles, setActivePhoto } from "store/photos";
import styles from "./photos.module.css";
import { secondsIntoDayFromZuluDateString, timeFromZuluDate } from "utils/formatting";

/**
 * Renders a video and the downlink buttons
 */
export default function Photos() {
  const dispatch = useDispatch();
  const { photos, clock }: { photos: PhotosState; clock: ClockState } = useSelector(
    (state) => state
  );

  const photoFiles = selectPhotoFiles(photos);

  const changePhoto = () => {
    if (!photos.ready) {
      return;
    }

    /* Loop through all returned photos in order of date_taken
     * break as soon as we hit a photo that was taken after clock.time leaving the data we gathered
     * on the previous photo for use.
     */
    let thisPhotoFile = initialPhotoFileState;
    for (let i = 0; i < photoFiles.length; i++) {
      const secondsIntoToday = secondsIntoDayFromZuluDateString(photoFiles[i].date_taken);
      if (secondsIntoToday > clock.time) {
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

  useEffect(changePhoto, [clock.time, photos.photos]);

  const renderPhotoOverlay = () => {
    let ioSearchLink = "";
    let ioHighResURL = "";
    let openURLMessage = "";
    let photoFilename = "";
    let dateAdded = "";
    let dateTaken = "";
    let openOnIOMessage = "";
    let info = "";
    let displayClass = styles.hidden;
    if (photos.activePhoto) {
      photoFilename = photos.activePhoto.id;
      ioSearchLink = photos.activePhoto.ioInfoURL;
      ioHighResURL = photos.activePhoto.highResURL;
      openURLMessage = `Open high res file directly`;
      openOnIOMessage = `Open on IO`;
      dateAdded =
        photos.activePhoto.date_added !== ""
          ? new Date(photos.activePhoto.date_added).toUTCString()
          : "-";
      dateTaken =
        photos.activePhoto.date_taken !== ""
          ? new Date(photos.activePhoto.date_taken).toUTCString()
          : "-";
      displayClass = "";
    }

    return (
      <div className={`${styles.photoOverlay} ${displayClass}`}>
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
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>Video URL</div>
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
  if (photos.activePhoto.date_taken !== "") {
    dateTakenLabel = "Taken:";
    dateTakenValue = `${timeFromZuluDate(new Date(photos.activePhoto.date_taken))}Z`;
  }

  return (
    <div className={styles.mediaPanel} key={`photo_viewer`}>
      <div style={{ display: "flex" }}>
        <div className={styles.infoButton}>
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
