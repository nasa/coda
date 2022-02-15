import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { useDispatch, useSelector } from "react-redux";
import { setPaneStateValue } from "store/framework";
import { RootState } from "store/index";
import { photosSelectors, setActivePhoto } from "store/photos";
import { changeTime } from "store/playhead";
import { LazyLoadImage } from "react-lazy-load-image-component";

import styles from "./photo-all.module.css";
import { useEffect, useRef } from "react";
import { hhmmssFromSeconds } from "utils/formatting";

export function PhotoAllControls(props: { frameID: number }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const paneStateData: PhotoAllPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

  let lockButtonSelected = "";
  if (typeof paneStateData !== "undefined" && paneStateData.lockPhotosScroll) {
    lockButtonSelected = styles.lockButtonSelected;
  }

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}></div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <button
            className={`${styles.lockButton} ${lockButtonSelected}`}
            title={`Scroll automatically to the current photo`}
            onClick={() => {
              setPaneStateValue(
                dispatch,
                frameID,
                "lockPhotosScroll",
                !paneStateData.lockPhotosScroll
              );
            }}
          >
            <span className={styles.lockButtonLabel}>Lock Scroll</span>
          </button>
        </div>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => {
              setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
            }}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
}

export default function PhotoAllPane(props: { frameID: number }) {
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const paneStateData: PhotoAllPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

  const photoFiles = photosSelectors.selectAll(photos);
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const photoThumbsRef = useRef<HTMLDivElement>(null);
  const activePhotoRef = useRef<HTMLDivElement>(null);

  /** Handle photo thumbs scroll event */
  // useEffect(() => {
  //   const handleScroll = () => {
  //     setPaneStateValue(dispatch, frameID, "lockPhotosScroll", false);
  //   };
  //   window.addEventListener("scroll", handleScroll);

  //   return () => {
  //     window.removeEventListener("scroll", handleScroll);
  //   };
  // }, []);

  const handleScroll = () => {
    setPaneStateValue(dispatch, frameID, "lockPhotosScroll", false);
  };

  useEffect(() => {
    if (paneStateData.lockPhotosScroll && activePhotoRef.current !== null) {
      activePhotoRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [photos.activePhoto, activePhotoRef, playhead.seconds]);

  // function that displays thumbnails of all photos in photoFiles
  function photoThumbnails() {
    let photoThumbnails = [];

    for (let i = 0; i < photoFiles.length; i++) {
      const activeRefOnly =
        photoFiles[i].id === photos.activePhoto.id ? { ref: activePhotoRef } : {};
      const activePhotoStyle = photoFiles[i].id === photos.activePhoto.id ? styles.activePhoto : "";
      const photoTime = hhmmssFromSeconds(photoFiles[i].datetimeTakenAppSeconds);
      const title = typeof photoFiles[i].title !== "undefined" ? " - " + photoFiles[i].title : "";
      const description = photoFiles[i].description !== "" ? " - " + photoFiles[i].description : "";
      const photoTitle = `${photoTime} ${photoFiles[i].id}${title}${description}`;
      photoThumbnails.push(
        <div
          className={`${styles.photoThumb} ${activePhotoStyle}`}
          key={photoFiles[i].id}
          {...activeRefOnly}
          onClick={() => {
            dispatch(changeTime(photoFiles[i].datetimeTakenAppSeconds));
            dispatch(setActivePhoto(photoFiles[i]));
          }}
          title={photoTitle}
        >
          <LazyLoadImage
            alt={photoFiles[i].title}
            width={80}
            height={80}
            src={photoFiles[i].mediaLowResURL}
          />
        </div>
      );
    }
    return photoThumbnails;
  }

  return (
    <div className={styles.main}>
      <div
        className={styles.photoThumbs}
        ref={photoThumbsRef}
        onWheel={() => {
          handleScroll();
        }}
      >
        {photoThumbnails()}
      </div>
      <HelpOverlay
        isModalOpen={paneStateData.showHelp}
        closeHandler={() => {
          setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
        }}
      >
        <div>
          <p>Click on a photo thumbnail to jump to the moment the photo was taken.</p>
        </div>
      </HelpOverlay>
    </div>
  );
}
