import { FunctionComponent } from "react";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { setPaneStateDataValue } from "store/framework";
import HelpOverlay from "components/interface/pane-help-overlay";
import styles from "./video-poster.module.css";
import { VideoGeneralHelpContent } from "./video-help";

/**
 * Determines the poster state to display based on video status.
 * - "novid": No video available
 * - "buffering": Video is loading (show spinner)
 * - "none": Video is playing or ready
 */
export const getPosterState = (
  metadata: VideoMetadata | null,
  status: VideoStatus
): PosterState => {
  if (metadata || status === "playing") return "none";
  if (status === "buffering" && !metadata) return "buffering";
  if (status === "buffering" && metadata) return "none";
  return "novid";
};

/**
 * Renders video poster overlays for loading/no-video states.
 */
export const VideoPoster: FunctionComponent<{ state: PosterState }> = ({ state }) => {
  if (state === "none") return null;

  return (
    <>
      <div className={styles.playerPosterNovid} />
      {state === "buffering" && (
        <div className={styles.playerPosterBuffering}>
          <div className={styles.loaderAnimation} />
        </div>
      )}
    </>
  );
};

/**
 * Standalone poster pane for when no video source is available.
 * Used by VideoPaneChooser when there's no IO, HLS, or MTX video.
 */
export const VideoPosterPane: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const dispatch = useAppDispatch();
  const paneStateData = useAppSelector(
    (state) => state.framework.frames[frameID].paneStateData as VideoPaneStateData,
    deepEqual
  );

  const handleHelpClose = () => {
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: "showHelp",
        paneStateValue: !paneStateData.showHelp,
      })
    );
  };

  return (
    <div className={styles.mediaPanel} key={`video_poster__${frameID}`} data-frame-id="No Video">
      <div className={styles.vidContainer}>
        <VideoPoster state="novid" />

        <HelpOverlay isModalOpen={paneStateData.showHelp} closeHandler={handleHelpClose}>
          <VideoGeneralHelpContent />
        </HelpOverlay>
      </div>
    </div>
  );
};
