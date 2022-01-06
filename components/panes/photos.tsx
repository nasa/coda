import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  initialPhotoFileState,
  setActivePhoto,
  setCollectionFilters,
  photosSelectors,
  filterVisiblePhotos,
} from "store/photos";
import styles from "./photos.module.css";
import { appSecondsFromDateString, hhmmssFromSeconds } from "utils/formatting";
import type { RootState } from "store/index";
import { cleanCollectionsString } from "utils/formatting";
import { setPaneStateDataValue } from "store/viewer";
import { ExpandButton, IOInfoButton } from "./video";

export function FilterButton(props: { clickHandler; selected?: boolean }) {
  const selectedStyle = props.selected ? styles.selected : "";
  return (
    <button
      className={`${styles.filterButton} ${selectedStyle}`}
      onClick={() => {
        props.clickHandler();
      }}
    >
      <span className={styles.filterLabel}>Filter Photos</span>
    </button>
  );
}

export function PhotoControls(props: { frameID: number; frameWidth: number }) {
  const frameID = props.frameID;

  const dispatch = useDispatch();

  const paneStateData: PhotoPaneControlStateData = useSelector(
    (state: RootState) => state.viewer.frames[props.frameID].paneStateData
  );
  function setPaneStateValue(propertyName, propertyValue) {
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: propertyName,
        paneStateValue: propertyValue,
      })
    );
  }

  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);

  let datetimeTakenLabel = "";
  let datetimeTakenValue = "";
  let timeSinceTaken = "";
  let currentlyActivePhoto = false;

  useEffect(() => {
    currentlyActivePhoto = photos.activePhoto.datetimeTaken !== "";
    if (currentlyActivePhoto) {
      timeSinceTaken = `(${hhmmssFromSeconds(
        Math.round(playhead.seconds - appSecondsFromDateString(photos.activePhoto.datetimeTaken))
      )} ago)`;
    }
  }, [photos, playhead]);

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.controlsLeft}>
          <span style={{ marginRight: "5px" }} className={styles.photoHeaderText}>
            X{datetimeTakenLabel} {datetimeTakenValue} {timeSinceTaken}
          </span>
        </div>
        <div className={styles.rightButtons}>
          <div className={styles.verticalCenter}>
            <IOInfoButton
              clickHandler={() => {
                if (currentlyActivePhoto) {
                  setPaneStateValue("infoToggle", !paneStateData.infoToggle);
                }
              }}
              selected={paneStateData.infoToggle}
            />
          </div>
          <div className={styles.verticalCenter}>
            <FilterButton
              clickHandler={() => {
                setPaneStateValue("filterToggle", !paneStateData.filterToggle);
              }}
              selected={paneStateData.filterToggle}
            />
          </div>
          <div className={styles.verticalCenter}>
            <ExpandButton />
          </div>
        </div>
      </div>
      {/* <div style={{ display: "flex" }}>        
        <div
          className={`${styles.filterButton}  ${filterButtonStyle}`}
          title={`Click to filter imagery`}
          onClick={() => {
            setPaneStateValue("filterToggle", !paneStateData.filterToggle);
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
      </div> */}
    </>
  );
}

export default function PhotoPane(props: { frameID: number; frameWidth: number }) {
  const dispatch = useDispatch();
  const frameID = props.frameID;

  const paneStateData: PhotoPaneControlStateData = useSelector(
    (state: RootState) => state.viewer.frames[frameID].paneStateData
  );

  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);

  const photoFiles = photosSelectors.selectAll(photos);

  const changePhoto = () => {
    if (!photos.ready) {
      return;
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

      // filter photos against collectionFilters
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

  useEffect(changePhoto, [playhead.date, playhead.seconds, photoFiles, photos]);

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

      if (paneStateData.infoToggle) {
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
    if (paneStateData.filterToggle && !paneStateData.infoToggle) {
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

  return (
    <div className={styles.mediaPanel} key={`photo_viewer`}>
      <div key={`photo_element`} className={styles.photoContainer}>
        <a className={styles.photoLink} href={photos.activePhoto.mediaHighResURL} target="_blank">
          <img className={styles.photo} src={photos.activePhoto.mediaLowResURL} />
        </a>
        {paneStateData.infoToggle ? renderPhotoOverlay() : renderPhotoFilter()}
      </div>
    </div>
  );
}
