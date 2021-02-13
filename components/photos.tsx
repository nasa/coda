import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { ClockState, isSameDate } from "store/clock";
import { PhotosState, selectPhotoFiles } from "store/photos";
import styles from "./photos.module.css";

/**
 * Renders a video and the downlink buttons
 */
export default function Photos() {
  const { query } = useRouter();
  const { photos, clock }: { photos: PhotosState; clock: ClockState } = useSelector(
    (state) => state
  );
  const [sourceURL, setSourceURL] = useState("");
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

    setSourceURL("/coda/images/vintage_static.gif");

    for (let i = 0; i < photoFiles.length; i++) {
      // console.log("looping through photos");
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
        <img className={styles.photo} src={sourceURL} />
        <div className={styles.photoOverlay}>
          <div className={styles.photoInfo}>{info}</div>
        </div>
      </div>
    </div>
  );
}
