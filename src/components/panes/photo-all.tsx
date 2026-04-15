import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { setPaneStateDataValue } from "store/framework";
import { setActivePhoto } from "store/photos";

import styles from "./photo-all.module.css";
import { FunctionComponent, useCallback, useEffect, useRef } from "react";
import { hhmmssFromSeconds } from "utils/formatting";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faLockOpen } from "@fortawesome/free-solid-svg-icons";
import { FilterButton, RenderPhotoFilter } from "components/interface/photo-filter-button";
import { setAppSeconds } from "store/clock";

function useLazyImages(containerRef: React.RefObject<HTMLDivElement | null>) {
  const pendingRef = useRef(new Set<HTMLImageElement>());
  const scrollingRef = useRef(false);

  const loadVisible = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const viewTop = container.scrollTop;
    const viewBottom = container.scrollTop + container.clientHeight + 100;
    pendingRef.current.forEach((img) => {
      if (img.offsetTop + img.offsetHeight > viewTop && img.offsetTop < viewBottom) {
        img.src = img.dataset.lazySrc!;
        pendingRef.current.delete(img);
      }
    });
  }, [containerRef]);

  const beginProgrammaticScroll = useCallback(() => {
    scrollingRef.current = true;
  }, []);

  const endProgrammaticScroll = useCallback(() => {
    scrollingRef.current = false;
    loadVisible();
  }, [loadVisible]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      if (scrollingRef.current) return;
      clearTimeout(timer);
      timer = setTimeout(loadVisible, 100);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [containerRef, loadVisible]);

  const register = useCallback((img: HTMLImageElement | null, src: string | undefined) => {
    if (!img || !src) return;
    img.dataset.lazySrc = src;
    pendingRef.current.add(img);
  }, []);

  return { register, loadVisible, beginProgrammaticScroll, endProgrammaticScroll };
}

export const PhotoAllControls: FunctionComponent<{
  paneInstanceId: number;
  groupDimensions: number[];
}> = ({ paneInstanceId, groupDimensions }) => {
  const dispatch = useAppDispatch();

  const minWidth = 470;

  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as PhotoAllPaneStateData,
    deepEqual
  );

  const buttonLength = groupDimensions[0] > minWidth ? styles.buttonLong : styles.buttonShort;
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
                  paneInstanceId,
                  paneStateProperty: "lockScroll",
                  paneStateValue: !paneStateData.lockScroll,
                })
              );
            }}
          >
            {groupDimensions[0] > minWidth ? (
              <span className={styles.buttonLabel}>
                <div>{groupDimensions[0] > minWidth ? "Scroll" : ""}</div>
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
                  paneInstanceId,
                  paneStateProperty: "showFilter",
                  paneStateValue: !paneStateData.showFilter,
                })
              );
            }}
            selected={paneStateData.showFilter}
            groupDimensions={groupDimensions}
          />
        </div>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => {
              dispatch(
                setPaneStateDataValue({
                  paneInstanceId,
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

const PhotoAllPane: FunctionComponent<{ paneInstanceId: number }> = ({ paneInstanceId }) => {
  const photos: PhotosState = useAppSelector((state) => state.photos, deepEqual);
  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as PhotoAllPaneStateData,
    deepEqual
  );

  const photoFiles = photos.photoFiles;
  const dispatch = useAppDispatch();

  const activePhotoRef = useRef<HTMLDivElement>(null);
  const thumbsContainerRef = useRef<HTMLDivElement>(null);
  const { register, loadVisible, beginProgrammaticScroll, endProgrammaticScroll } =
    useLazyImages(thumbsContainerRef);

  useEffect(() => {
    if (paneStateData.lockScroll && activePhotoRef.current !== null) {
      beginProgrammaticScroll();
      activePhotoRef.current.scrollIntoView({
        behavior: "smooth",
      });
      // Smooth scroll typically completes in ~500-1000ms
      const timer = setTimeout(endProgrammaticScroll, 1000);
      return () => {
        clearTimeout(timer);
        endProgrammaticScroll();
      };
    }
    return undefined;
  }, [
    photos.activePhoto,
    activePhotoRef,
    paneStateData.lockScroll,
    beginProgrammaticScroll,
    endProgrammaticScroll,
  ]);

  // Load visible images when photo list changes
  useEffect(() => {
    loadVisible();
  }, [photoFiles, loadVisible]);

  // function that displays thumbnails of all photos in photoFiles
  function photoThumbnails() {
    const photoThumbnails = [];

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
              <img
                ref={(el) => register(el, photoFiles[i].mediaThumbURL)}
                alt={photoFiles[i].title}
                width={80}
                height={80}
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
      <div className={styles.photoThumbs} ref={thumbsContainerRef}>
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
              paneInstanceId,
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
            <a
              href={"https://io.jsc.nasa.gov/app/collections.cfm?cid=4"}
              target={"_blank"}
              rel="noopener noreferrer"
            >
              ISS Collection
            </a>
            . Exploration Test Events usually pulls from the root{" "}
            <a
              href={"https://io.jsc.nasa.gov/app/collections.cfm?cid=2359928"}
              target={"_blank"}
              rel="noopener noreferrer"
            >
              xEVA Collection
            </a>{" "}
            but can be overridden by editing the CODA entry for each event in the{" "}
            <a
              href={"https://wiki.jsc.nasa.gov/exploration/index.php/Main_Page"}
              target={"_blank"}
              rel="noopener noreferrer"
            >
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
