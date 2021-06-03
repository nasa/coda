import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { PlayheadState } from "store/playhead";
import {
  initialPhotoFileState,
  setActivePhoto,
  setCollectionFilters,
  photosSelectors,
  PhotosEntityState,
} from "store/photos";
import styles from "./photos.module.css";

import {
  appSecondsFromDateString,
  hhmmssFromDateString,
  hhmmssFromSeconds,
} from "utils/formatting";
import type { RootState } from "store/index";

export default function Photos() {
  const dispatch = useDispatch();

  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);

  const [infoToggle, setInfoToggle] = useState(false);
  const [infoHover, setInfoHover] = useState(false);
  const [filterToggle, setFilterToggle] = useState(false);

  const photoFiles = photosSelectors.selectAll(photos);

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

      //filter photos against collectionFilters
      let showThisPhoto = false;
      for (let j = 0; j < photos.collectionFilters.length; j++) {
        if (
          photoFiles[i].collections_string === photos.collectionFilters[j].fullList &&
          photos.collectionFilters[j].selected
        ) {
          showThisPhoto = true;
          break;
        }
      }
      if (showThisPhoto) {
        thisPhotoFile = photoFiles[i];
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

  useEffect(changePhoto, [playhead.seconds, photoFiles, photos]);

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
      ioSearchLink = photos.activePhoto.dataURL;
      ioHighResURL = photos.activePhoto.mediaHighResURL;
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
        infoDisplayClass = styles.overlayVisible;
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
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>Collection</div>
            <div className={`${styles.overlayTableCell}`}>
              {photos.activePhoto.collections_string_pretty}
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
        <a className={styles.photoLink} href={photos.activePhoto.mediaHighResURL} target="_blank">
          <img className={styles.photo} src={photos.activePhoto.mediaLowResURL} />
        </a>
        {infoHover || infoToggle ? renderPhotoOverlay() : renderPhotoFilter()}
      </div>
    </div>
  );
}
