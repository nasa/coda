import { FunctionComponent, useEffect, useState } from "react";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { initialPhotoFileState, setActivePhoto } from "store/photos";
import styles from "./photo.module.css";
import { appSecondsFromDateString, hhmmssFromSeconds } from "utils/formatting";
import { cleanCollectionsString } from "utils/formatting";
import { setPaneStateValue } from "store/framework";
import { IOInfoButton } from "./video/video-controls";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { FilterButton, RenderPhotoFilter } from "components/interface/photo-filter-button";
import ClockInterval from "components/framework/ClockInterval";

export const PhotoControls: FunctionComponent<{ frameID: number; frameDimensions: number[] }> = ({
  frameID,
  frameDimensions,
}) => {
  const dispatch = useAppDispatch();

  const paneStateData: PhotoPaneStateData = useAppSelector(
    (state) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );

  const photos: PhotosState = useAppSelector((state) => state.photos, deepEqual);

  const [appSeconds, setLocalAppSeconds] = useState(0);

  let datetimeTakenLabel = "";
  let datetimeTakenValue = "";
  let timeSinceTaken = "";
  let currentlyActivePhoto = false;

  useEffect(() => {
    currentlyActivePhoto = photos.activePhoto.datetimeTaken !== "";
    if (currentlyActivePhoto) {
      timeSinceTaken = `(${hhmmssFromSeconds(
        Math.round(appSeconds - appSecondsFromDateString(photos.activePhoto.datetimeTaken))
      )} ago)`;
    }
  }, [photos, appSeconds]);

  return (
    <>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
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
              frameDimensions={frameDimensions}
            />
          </div>
          <div className={styles.verticalCenter}>
            <FilterButton
              clickHandler={() => {
                setPaneStateValue(dispatch, frameID, "showFilter", !paneStateData.showFilter);
              }}
              selected={paneStateData.showFilter}
              frameDimensions={frameDimensions}
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
};

const PhotoPane: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const dispatch = useAppDispatch();

  const paneStateData: PhotoPaneStateData = useAppSelector(
    (state) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );

  const photos: PhotosState = useAppSelector((state) => state.photos, deepEqual);
  const photoFiles = photos.photoFiles;

  const [appSeconds, setLocalAppSeconds] = useState(0);

  const changePhoto = () => {
    if (!photos.ready) {
      return;
    }

    /* Loop through all returned photos in order of datetimeTaken
     * break as soon as we hit a photo that was taken after appSeconds leaving the data we gathered
     * on the previous photo for use.
     */
    let thisPhotoFile = initialPhotoFileState;
    for (let i = 0; i < photoFiles?.length; i++) {
      const secondsIntoToday = photoFiles[i].datetimeTakenAppSeconds;
      if (secondsIntoToday > appSeconds) {
        break;
      }

      // filter photos against collectionFilters
      for (let j = 0; j < photos.collectionFilters.length; j++) {
        if (
          photoFiles[i].collections === photos.collectionFilters[j].fullList &&
          photos.collectionFilters[j].selected
        ) {
          thisPhotoFile = photoFiles[i];
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

  useEffect(changePhoto, [appSeconds, photoFiles, photos]);

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
            <tr>
              <td>Date Taken</td>
              <td>{datetimeTaken}</td>
            </tr>
            <tr>
              <td>Date Added</td>
              <td>{dateAdded}</td>
            </tr>
            <tr>
              <td>Collection</td>
              <td>{cleanCollectionsString(photos.activePhoto.collections)}</td>
            </tr>
            <tr>
              <td>IO Asset Name</td>
              <td>
                <a href={ioSearchLink} target="_blank" style={{ fontSize: "0.9em" }}>
                  {openOnIOMessage}
                </a>
                <td>{photoFilename}</td>
              </td>
            </tr>
            <tr>
              <td>High Res</td>
              <td>
                <a href={ioHighResURL} target="_blank" style={{ fontSize: "0.9em" }}>
                  {openURLMessage}
                </a>
                <br />
                <span className={styles.digiValue} style={{ fontSize: "0.9em", color: "#BBBBBB" }}>
                  {ioHighResURL}
                </span>
              </td>
            </tr>
            <tr>
              <td>IO Description</td>
              <td>{info}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={styles.mediaPanel} key={`photo_viewer`}>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
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
            {paneStateData.showInfo ? renderPhotoOverlay() : null}
            {paneStateData.showFilter ? <RenderPhotoFilter /> : null}
          </>
        ) : (
          <div className={styles.photoPoster}>
            <div className={styles.photoPosterFilter}>
              {paneStateData.showFilter ? <RenderPhotoFilter /> : null}
            </div>
          </div>
        )}
      </div>
      <HelpOverlay
        isModalOpen={paneStateData.showHelp}
        closeHandler={() => {
          setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
        }}
      >
        <div>
          <p>Displays the photo taken most recently relative to the time being viewed in CODA.</p>
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
        </div>
      </HelpOverlay>
    </div>
  );
};

export default PhotoPane;
