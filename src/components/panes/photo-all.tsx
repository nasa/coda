import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { setPaneStateDataValue } from "store/framework";
import { setActivePhoto } from "store/photos";
import { LazyLoadImage } from "react-lazy-load-image-component";

import styles from "./photo-all.module.css";
import { FunctionComponent, useEffect, useRef } from "react";
import { hhmmssFromSeconds } from "utils/formatting";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faLockOpen } from "@fortawesome/free-solid-svg-icons";
import { FilterButton, RenderPhotoFilter } from "components/interface/photo-filter-button";
import { setAppSeconds } from "store/clock";

export const PhotoAllControls: FunctionComponent<{
  frameID: number;
  frameDimensions: number[];
}> = ({ frameID, frameDimensions }) => {
  const dispatch = useAppDispatch();

  const minWidth = 470;

  const paneStateData: PhotoAllPaneStateData = useAppSelector(
    (state) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );

  const buttonLength = frameDimensions[0] > minWidth ? styles.buttonLong : styles.buttonShort;
  let lockButtonSelected = "";
  if (typeof paneStateData !== "undefined" && paneStateData.lockScroll) {
    lockButtonSelected = styles.lockButtonSelected;
  }

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}></div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <button
            className={`${styles.lockButton} ${buttonLength} ${lockButtonSelected}`}
            title={`Scroll automatically to the current photo`}
            onClick={() => {
              dispatch(
                setPaneStateDataValue({
                  frameID,
                  paneStateProperty: "lockScroll",
                  paneStateValue: !paneStateData.lockScroll,
                })
              );
            }}
          >
            {frameDimensions[0] > minWidth ? (
              <span className={styles.buttonLabel}>
                <div>{frameDimensions[0] > minWidth ? "Scroll" : ""}</div>
                <div>
                  <FontAwesomeIcon
                    icon={paneStateData.lockScroll ? faLock : faLockOpen}
                    size="sm"
                  />
                </div>
              </span>
            ) : (
              <FontAwesomeIcon icon={paneStateData.lockScroll ? faLock : faLockOpen} size="sm" />
            )}
          </button>
        </div>
        <div className={styles.verticalCenter}>
          <FilterButton
            clickHandler={() => {
              dispatch(
                setPaneStateDataValue({
                  frameID,
                  paneStateProperty: "showFilter",
                  paneStateValue: !paneStateData.showFilter,
                })
              );
            }}
            selected={paneStateData.showFilter}
            frameDimensions={frameDimensions}
          />
        </div>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => {
              dispatch(
                setPaneStateDataValue({
                  frameID,
                  paneStateProperty: "showHelp",
                  paneStateValue: !paneStateData.showHelp,
                })
              );
            }}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
};

const PhotoAllPane: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const photos: PhotosState = useAppSelector((state) => state.photos, deepEqual);
  const paneStateData: PhotoAllPaneStateData = useAppSelector(
    (state) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );

  const photoFiles = photos.photoFiles;
  const dispatch = useAppDispatch();

  const activePhotoRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: "lockPhotosScroll",
        paneStateValue: false,
      })
    );
  };

  useEffect(() => {
    if (paneStateData.lockScroll && activePhotoRef.current !== null) {
      activePhotoRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [photos.activePhoto, activePhotoRef, paneStateData.lockScroll]);

  // function that displays thumbnails of all photos in photoFiles
  function photoThumbnails() {
    let photoThumbnails = [];

    for (let i = 0; i < photoFiles.length; i++) {
      for (let j = 0; j < photos.collectionFilters.length; j++) {
        if (
          photoFiles[i].collections == photos.collectionFilters[j].fullList &&
          photos.collectionFilters[j].selected
        ) {
          const activeRefOnly =
            photoFiles[i].id === photos.activePhoto.id ? { ref: activePhotoRef } : {};
          const activePhotoStyle =
            photoFiles[i].id === photos.activePhoto.id ? styles.activePhoto : "";
          const photoTime = hhmmssFromSeconds(photoFiles[i].datetimeTakenAppSeconds);
          const title =
            typeof photoFiles[i].title !== "undefined" ? " - " + photoFiles[i].title : "";
          const description =
            photoFiles[i].description !== "" ? " - " + photoFiles[i].description : "";
          const photoTitle = `${photoTime} ${photoFiles[i].id}${title}${description}`;
          photoThumbnails.push(
            <div
              className={`${styles.photoThumb} ${activePhotoStyle}`}
              key={photoFiles[i].id}
              {...activeRefOnly}
              onClick={() => {
                dispatch(setAppSeconds(photoFiles[i].datetimeTakenAppSeconds));
                dispatch(setActivePhoto(photoFiles[i]));
              }}
              title={photoTitle}
            >
              <LazyLoadImage
                alt={photoFiles[i].title}
                width={80}
                height={80}
                src={photoFiles[i].mediaThumbURL}
              />
            </div>
          );
        }
      }
    }
    return photoThumbnails;
  }

  return (
    <div className={styles.main}>
      <div
        className={styles.photoThumbs}
        onWheel={() => {
          handleScroll();
        }}
      >
        {photos.collectionFilters.some((el) => el.selected === true) ? (
          photoThumbnails()
        ) : (
          <div className={styles.photoPoster}>
            <div className={styles.photoPosterFilter}></div>
          </div>
        )}
        {paneStateData.showFilter ? <RenderPhotoFilter /> : null}
      </div>
      <HelpOverlay
        isModalOpen={paneStateData.showHelp}
        closeHandler={() => {
          dispatch(
            setPaneStateDataValue({
              frameID,
              paneStateProperty: "showHelp",
              paneStateValue: !paneStateData.showHelp,
            })
          );
        }}
      >
        <div>
          <p>Displays all of the photos on Imagery Online taken on the selected event date.</p>
          <p>
            Photos are all pulled from Imagery Online collections. ISS displays photos in the{" "}
            <a href={"https://io.jsc.nasa.gov/app/collections.cfm?cid=4"} target={"_blank"}>
              ISS Collection
            </a>
            . Exploration Test Events usually pulls from the root{" "}
            <a href={"https://io.jsc.nasa.gov/app/collections.cfm?cid=2359928"} target={"_blank"}>
              xEVA Collection
            </a>{" "}
            but can be overridden by editing the CODA entry for each event in the{" "}
            <a href={"https://wiki.jsc.nasa.gov/exploration/index.php/Main_Page"} target={"_blank"}>
              Exploration Wiki.
            </a>
          </p>
          <p>Click on a photo thumbnail to jump to the moment the photo was taken.</p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default PhotoAllPane;
