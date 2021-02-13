import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { ClockState, isSameDate } from "store/clock";
import { PhotosState, selectPhotoFiles } from "store/photos";
import styles from "./photos.module.css";
import { secondsIntoDayFromZuluDateString } from "utils/formatting";
import { PhotoFile } from "services/io";

/**
 * Renders a video and the downlink buttons
 */
export default function Photos() {
  const { query } = useRouter();
  const { photos, clock }: { photos: PhotosState; clock: ClockState } = useSelector(
    (state) => state
  );
  const initialPhotoFile: PhotoFile = {
    id: "",
    description: "",
    photoURL: "/coda/images/vintage_static.gif",
    url: "",
    date_added: "",
    date_taken: "",
  };
  const [activePhoto, setActivePhoto] = useState(initialPhotoFile);
  const [info, setInfo] = useState("");

  const photoFiles = selectPhotoFiles(photos);

  const changePhoto = () => {
    // This stops one buffering video from essentially blocking beginning to buffer the other video
    // if (!clock.isRunning) {
    //   return;
    // }

    if (!photos.ready) {
      return;
    }

    /* Loop through all returned photos
     * (that API returns in order of date taken thanks to parameter we send in IO.ts)
     * break as soon as we hit a photo that was taken after clock.time leaving the data we gathered
     * on the previous photo for use.
     */
    let thisPhotoFile = initialPhotoFile;
    for (let i = 0; i < photoFiles.length; i++) {
      const isoTimestamp = new Date(photoFiles[i].date_taken).toISOString();
      const secondsIntoToday = secondsIntoDayFromZuluDateString(isoTimestamp);
      if (secondsIntoToday > clock.time) {
        break;
      }
      thisPhotoFile = photoFiles[i];
    }
    if (Object.keys(thisPhotoFile).length !== 0) {
      if (thisPhotoFile.photoURL !== activePhoto.photoURL) {
        setActivePhoto(thisPhotoFile);
      }
    }
  };

  useEffect(changePhoto, [clock.time, photos.photos]);

  return (
    <div className={styles.mediaPanel} key={`photo_viewer`}>
      <button>button</button>
      <div
        key={`photo_element`}
        className={`${styles.photoContainer} ${styles.photoContainer4by3}`}
      >
        <div className={styles.photoPoster}></div>
        <img className={styles.photo} src={activePhoto.photoURL} />
        <div className={styles.photoOverlay}>
          <div className={styles.photoInfo}>{info}</div>
        </div>
      </div>
    </div>
  );
}
