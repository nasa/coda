import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { PlayheadState } from "store/playhead";
import {
  initialPhotoFileState,
  setActivePhoto,
  setCollectionFilters,
  photosSelectors,
  PhotosEntityState,
  filterVisiblePhotos,
} from "store/photos";
import styles from "./photos.module.css";

import {
  appSecondsFromDateString,
  hhmmssFromDateString,
  hhmmssFromSeconds,
} from "utils/formatting";
import type { RootState } from "store/index";
import { cleanCollectionsString } from "utils/formatting";
import { AncillaryState } from "store/ancillary";

export default function Photos() {
  const dispatch = useDispatch();

  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);
  const ancillaryState: AncillaryState = useSelector((state: RootState) => state.ancillary);

  const [infoToggle, setInfoToggle] = useState(false);
  const [infoHover, setInfoHover] = useState(false);
  const [filterToggle, setFilterToggle] = useState(false);

  const changePhoto = () => {
    if (!photos.ready) {
      return;
    }

    //use ancillary photos instead of IO photos if there are any
    let photoFiles = [];
    let usingAncillary = false;
    if (ancillaryState.ancillaryData.photos.length > 0) {
      photoFiles = ancillaryState.ancillaryData.photos;
      usingAncillary = true;
    } else {
      photoFiles = photosSelectors.selectAll(photos);
    }

    const visiblePhotos = filterVisiblePhotos(photoFiles, new Date(playhead.date));

    /* Loop through all returned photos in order of datetimeTaken
     * break as soon as we hit a photo that was taken after playhead.seconds leaving the data we gathered
     * on the previous photo for use.
     */

    let thisPhotoFile = initialPhotoFileState;
    for (let i = 0; i < visiblePhotos.length; i++) {
      const secondsIntoToday = visiblePhotos[i].datetimeTakenAppSeconds;
      if (secondsIntoToday > playhead.seconds) {
        break;
      }

      for (let j = 0; j < photos.collectionFilters.length; j++) {
        if (
          visiblePhotos[i].collections === photos.collectionFilters[j].fullList &&
          photos.collectionFilters[j].selected
        ) {
          thisPhotoFile = visiblePhotos[i];
          break;
        }
      }
    }

    if (Object.keys(thisPhotoFile).length !== 0) {
      if (thisPhotoFile.mediaLowResURL !== photos.activePhoto.mediaLowResURL) {
        dispatch(setActivePhoto(thisPhotoFile));
      }
    }
  };

  function changeFilter(index, value) {
    let filters = JSON.parse(JSON.stringify(photos.collectionFilters));
    filters[index].selected = value;
    dispatch(setCollectionFilters(filters));
  }

  function changeAllFilters(value) {
    let filters = JSON.parse(JSON.stringify(photos.collectionFilters));
    for (let i = 0; i < filters.length; i++) {
      filters[i].selected = value;
    }
    dispatch(setCollectionFilters(filters));
  }

  useEffect(changePhoto, [
    playhead.date,
    playhead.seconds,
    photos,
    ancillaryState.ancillaryData.photos,
  ]);

  const renderPhotoOverlay = () => {
    const currentlyActivePhoto = photos.activePhoto.datetimeTaken !== "";
    let ioSearchLink = "";
    let ioHighResURL = "";
    let openURLMessage = "";
    let photoFilename = "";
    let dateAdded = "";
    let datetimeTaken = "";
    let openOnIOMessage = "";
    let info = "";
    let infoDisplayClass = "";
    if (currentlyActivePhoto) {
      photoFilename = photos.activePhoto.id;
      ioSearchLink = photos.activePhoto.dataURL;
      ioHighResURL = photos.activePhoto.mediaHighResURL;
      openURLMessage = `Open high res`;
      openOnIOMessage = `Open on IO`;
      dateAdded =
        photos.activePhoto.dateAdded !== ""
          ? new Date(photos.activePhoto.dateAdded).toUTCString()
          : "-";
      datetimeTaken =
        photos.activePhoto.datetimeTaken !== ""
          ? new Date(photos.activePhoto.datetimeTaken).toUTCString()
          : "-";

      if (infoHover || infoToggle) {
        infoDisplayClass = styles.overlayVisible;
      }
    }

    return (
      <div className={`${styles.photoOverlay} ${infoDisplayClass}`}>
        <div className={styles.overlayTable}>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>Date Taken</div>
            <div className={`${styles.overlayTableCell}`}>{datetimeTaken}</div>
          </div>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>Date Added</div>
            <div className={`${styles.overlayTableCell}`}>{dateAdded}</div>
          </div>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>Collection</div>
            <div className={`${styles.overlayTableCell}`}>
              {cleanCollectionsString(photos.activePhoto.collections)}
            </div>
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

  const renderPhotoFilter = () => {
    let displayClass = "";
    if (filterToggle && (!infoHover || infoToggle)) {
      displayClass = styles.overlayVisible;
    }

    return (
      <div className={`${styles.photoOverlay} ${displayClass}`}>
        <div className={styles.overlayTable}>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}></div>
            <div className={`${styles.overlayTableCell}`}>
              <button
                className={styles.tableButton}
                onClick={() => {
                  changeAllFilters(true);
                }}
              >
                Check All
              </button>
              <button
                className={styles.tableButton}
                onClick={() => {
                  changeAllFilters(false);
                }}
              >
                Check None
              </button>
            </div>
          </div>
          {photos.collectionFilters.map((value, index) => {
            return (
              <div key={index} className={styles.overlayTableRow}>
                <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>
                  <input
                    className={styles.tableInput}
                    type="checkbox"
                    checked={value.selected}
                    onChange={() => {
                      changeFilter(index, !value.selected);
                    }}
                  />
                </div>
                <div className={`${styles.overlayTableCell}`}>{value.display}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  let datetimeTakenLabel = "";
  let datetimeTakenValue = "";
  let timeSinceTaken = "";
  let infoButtonStyle = "";
  const currentlyActivePhoto = photos.activePhoto.datetimeTaken !== "";
  if (currentlyActivePhoto) {
    timeSinceTaken = `(${hhmmssFromSeconds(
      Math.round(playhead.seconds - appSecondsFromDateString(photos.activePhoto.datetimeTaken))
    )} ago)`;
    datetimeTakenLabel = "Taken:";
    datetimeTakenValue = `${hhmmssFromDateString(photos.activePhoto.datetimeTaken)}Z`;
    infoButtonStyle = styles.infoActive;
  }
  if (infoToggle) {
    infoButtonStyle = styles.infoSelected;
  }
  let filterButtonStyle = "";
  if (filterToggle) {
    filterButtonStyle = styles.filterSelected;
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
        <div
          className={`${styles.filterButton}  ${filterButtonStyle}`}
          title={`Click to filter imagery`}
          onClick={() => {
            setFilterToggle(!filterToggle);
          }}
        >
          <div className={styles.infoText}>Filter Photos</div>
        </div>
        <div style={{ marginLeft: "auto", marginTop: "auto" }}>
          <span
            style={{ paddingRight: "5px" }}
            className={`${styles.photoHeaderText} ${styles.dimText}`}
          >
            {datetimeTakenLabel}
          </span>
          <span style={{ marginRight: "5px" }} className={styles.photoHeaderText}>
            {datetimeTakenValue}
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
        <a className={styles.photoLink} href={photos.activePhoto.mediaHighResURL} target="_blank">
          <img className={styles.photo} src={photos.activePhoto.mediaLowResURL} />
        </a>
        {infoHover || infoToggle ? renderPhotoOverlay() : renderPhotoFilter()}
      </div>
    </div>
  );
}
