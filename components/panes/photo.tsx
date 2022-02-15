import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  initialPhotoFileState,
  setActivePhoto,
  setCollectionFilters,
  photosSelectors,
  filterVisiblePhotos,
} from "store/photos";
import styles from "./photo.module.css";
import { appSecondsFromDateString, hhmmssFromSeconds } from "utils/formatting";
import type { RootState } from "store/index";
import { cleanCollectionsString } from "utils/formatting";
import { setPaneStateValue } from "store/framework";
import { IOInfoButton } from "./video";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";

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

export function PhotoControls(props: { frameID: number; frameDimensions: number[] }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const paneStateData: PhotoPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

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
            {datetimeTakenLabel} {datetimeTakenValue} {timeSinceTaken}
          </span>
        </div>
        <div className={styles.rightButtons}>
          <div className={styles.verticalCenter}>
            <IOInfoButton
              clickHandler={() => {
                setPaneStateValue(dispatch, frameID, "showInfo", !paneStateData.showInfo);
              }}
              selected={paneStateData.showInfo}
            />
          </div>
          <div className={styles.verticalCenter}>
            <FilterButton
              clickHandler={() => {
                setPaneStateValue(dispatch, frameID, "showFilter", !paneStateData.showFilter);
              }}
              selected={paneStateData.showFilter}
            />
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
    </>
  );
}

export default function PhotoPane(props: { frameID: number; frameDimensions: number[] }) {
  const dispatch = useDispatch();
  const frameID = props.frameID;

  const paneStateData: PhotoPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData
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
      if (thisPhotoFile.datetimeTaken !== photos.activePhoto.datetimeTaken) {
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

      if (paneStateData.showFilter || paneStateData.showInfo) {
        infoDisplayClass = styles.overlayVisible;
      }
    }

    return (
      <div className={`${styles.photoOverlay} ${infoDisplayClass}`}>
        <table className={styles.overlayTable}>
          <tbody>
            <tr className={styles.overlayTableRow}>
              <td className={`${styles.overlayTableCell} ${styles.titleRow}`}>Date Taken</td>
              <td className={`${styles.overlayTableCell}`}>{datetimeTaken}</td>
            </tr>
            <tr className={styles.overlayTableRow}>
              <td className={`${styles.overlayTableCell} ${styles.titleRow}`}>Date Added</td>
              <td className={`${styles.overlayTableCell}`}>{dateAdded}</td>
            </tr>
            <tr className={styles.overlayTableRow}>
              <td className={`${styles.overlayTableCell} ${styles.titleRow}`}>Collection</td>
              <td className={`${styles.overlayTableCell}`}>
                {cleanCollectionsString(photos.activePhoto.collections)}
              </td>
            </tr>
            <tr className={styles.overlayTableRow}>
              <td className={`${styles.overlayTableCell} ${styles.titleRow}`}>IO Asset Name</td>
              <td className={styles.overlayTableCell}>
                <a href={ioSearchLink} target="_blank" style={{ fontSize: "0.9em" }}>
                  {openOnIOMessage}
                </a>
                <td className={styles.digiValue}>{photoFilename}</td>
              </td>
            </tr>
            <tr className={styles.overlayTableRow}>
              <td className={`${styles.overlayTableCell} ${styles.titleRow}`}>High Res</td>
              <td className={styles.overlayTableCell}>
                <a href={ioHighResURL} target="_blank" style={{ fontSize: "0.9em" }}>
                  {openURLMessage}
                </a>
                <br />
                <span className={styles.digiValue} style={{ fontSize: "0.9em", color: "#BBBBBB" }}>
                  {ioHighResURL}
                </span>
              </td>
            </tr>
            <tr className={styles.overlayTableRow}>
              <td className={`${styles.overlayTableCell} ${styles.titleRow}`}>IO Description</td>
              <td className={styles.overlayTableCell}>{info}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderPhotoFilter = () => {
    let displayClass = "";
    if (paneStateData.showFilter && !paneStateData.showInfo) {
      displayClass = styles.overlayVisible;
    }

    return (
      <div className={`${styles.photoOverlay} ${displayClass}`}>
        <table className={styles.overlayTable}>
          <tbody>
            <tr className={styles.overlayTableRow}>
              <td className={`${styles.overlayTableCell} ${styles.titleRow}`}></td>
              <td className={`${styles.overlayTableCell}`}>
                <button
                  className={styles.filterButton}
                  onClick={() => {
                    changeAllFilters(true);
                  }}
                >
                  Check All
                </button>
                <button
                  className={styles.filterButton}
                  style={{ marginLeft: "0.5em" }}
                  onClick={() => {
                    changeAllFilters(false);
                  }}
                >
                  Check None
                </button>
              </td>
            </tr>
            {photos.collectionFilters.map((value, index) => {
              return (
                <tr key={index} className={styles.overlayTableRow}>
                  <td className={`${styles.overlayTableCell} ${styles.titleRow}`}>
                    <input
                      className={styles.tableInput}
                      type="checkbox"
                      checked={value.selected}
                      onChange={() => {
                        changeFilter(index, !value.selected);
                      }}
                    />
                  </td>
                  <td className={`${styles.overlayTableCell}`}>{value.display}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={styles.mediaPanel} key={`photo_viewer`}>
      <div key={`photo_element`} className={styles.photoContainer}>
        {photos.activePhoto.mediaLowResURL !== "" ? (
          <>
            <a
              className={styles.photoLink}
              href={photos.activePhoto.mediaHighResURL}
              target="_blank"
            >
              <img className={styles.photo} src={photos.activePhoto.mediaLowResURL} />
            </a>
            {paneStateData.showInfo ? renderPhotoOverlay() : renderPhotoFilter()}
          </>
        ) : (
          <div className={styles.photoPoster}></div>
        )}
      </div>
      <HelpOverlay
        isModalOpen={paneStateData.showHelp}
        closeHandler={() => {
          setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
        }}
      >
        <div>
          <p>
            The Photography Pane displays the photo taken most recently at the time being viewed in
            CODA.
          </p>
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
              Exploration Wiki
            </a>
          </p>
        </div>
      </HelpOverlay>
    </div>
  );
}
