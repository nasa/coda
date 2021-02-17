import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ClockState } from "store/clock";
import { PhotosState, selectPhotoFiles, setActivePhoto } from "store/photos";
import styles from "./photos.module.css";
import { secondsIntoDayFromZuluDateString, timeFromZuluDate } from "utils/formatting";
import { PhotoFile } from "services/io";

/**
 * Renders a video and the downlink buttons
 */
export default function Photos() {
  const dispatch = useDispatch();
  const { photos, clock }: { photos: PhotosState; clock: ClockState } = useSelector(
    (state) => state
  );

  const initialPhotoFile: PhotoFile = {
    id: "",
    description: "",
    lowResURL: "/coda/images/vintage_static.gif",
    highResURL: "",
    ioInfoURL: "",
    date_added: "",
    date_taken: new Date(clock.date).toISOString(),
  };

  // a sorted array of photoFile objects delivered by the store when it's ready
  const [photoFiles, setPhotoFiles] = useState([]);

  useEffect(() => {
    //populate the sorted array of photos only when the store changes to save processing time
    setPhotoFiles(selectPhotoFiles(photos));
    //set store to initialPhotoFile which contains some placeholder elements derived from active app
    if (photos.activePhoto.lowResURL === "") {
      dispatch(setActivePhoto(initialPhotoFile));
    }
  }, [photos.photos]);

  const changePhoto = () => {
    if (!photos.ready) {
      return;
    }

    /* Loop through all returned photos in order of date_taken
     * break as soon as we hit a photo that was taken after clock.time leaving the data we gathered
     * on the previous photo for use.
     */
    let thisPhotoFile = initialPhotoFile;
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

  const openInNewTab = (url) => {
    const newWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (newWindow) newWindow.opener = null;
  };

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
      dateAdded = new Date(photos.activePhoto.date_added).toUTCString();
      dateTaken = new Date(photos.activePhoto.date_taken).toUTCString();
      displayClass = "";
    }

    return (
      <div className={`${styles.photoOverlay} ${displayClass}`}>
        <div className={styles.overlayTable}>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>Date Taken</div>
            <div className={`${styles.overlayTableCell} ${styles.digiValue}`}>{dateTaken}</div>
          </div>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>Date Added</div>
            <div className={`${styles.overlayTableCell} ${styles.digiValue}`}>{dateAdded}</div>
          </div>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>IO Asset Name</div>
            <div className={styles.overlayTableCell}>
              <span className={styles.digiValue}>{photoFilename}</span> <br />
              <a href={ioSearchLink} target="_blank" style={{ fontSize: "0.9em" }}>
                {openOnIOMessage}
              </a>
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

  return (
    <div className={styles.mediaPanel} key={`photo_viewer`}>
      <button
        className={styles.photoButton}
        onClick={() => {
          openInNewTab(photos.activePhoto.ioInfoURL);
        }}
      >
        Photo Details
        <span
          style={{ marginLeft: "15px" }}
          className={`${styles.photoHeaderText} ${styles.dimText}`}
        >
          Taken:&nbsp;
        </span>
        <span className={styles.photoHeaderText}>
          {timeFromZuluDate(new Date(photos.activePhoto.date_taken))}Z
        </span>
      </button>
      <button
        className={styles.photoButton}
        onClick={() => {
          openInNewTab(photos.activePhoto.highResURL);
        }}
      >
        High Res
      </button>
      <div
        key={`photo_element`}
        className={`${styles.photoContainer} ${styles.photoContainer4by3}`}
      >
        <a href={photos.activePhoto.highResURL} target="_blank">
          <img className={styles.photo} src={photos.activePhoto.lowResURL} />
        </a>
        {renderPhotoOverlay()}
      </div>
    </div>
  );
}
