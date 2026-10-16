import { FunctionComponent, useEffect, useState } from "react";
import ClockInterval from "components/framework/ClockInterval";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { usePlayheadDate } from "store/hooks";
import { useAppDispatch } from "utils/useAppDispatch";
import { faChevronDown, faInfo, faVolumeUp, faVolumeMute } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button, { type ColorVariant, type RoundedVariant } from "components/interface/button";
import { visibleVideosBySecond } from "utils/video";
import { cleanCollectionsString } from "utils/formatting";
import { calculateChannelAvailability, determineVideoPlayerType } from "utils/video";
import styles from "./video-controls.module.css";
import { setPaneStateDataValue } from "store/framework";
import { HelpButton } from "components/interface/pane-help-control-button";

// ============================================================================
// Constants
// ============================================================================

const CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const MIN_WIDTH_FOR_LONG_BUTTON = 470;

// ============================================================================
// Button Components
// ============================================================================

export const IOInfoButton: FunctionComponent<{
  clickHandler: () => void;
  selected?: boolean;
  groupDimensions: number[];
}> = ({ clickHandler, selected, groupDimensions }) => {
  const isLargeFrame = groupDimensions[0] > MIN_WIDTH_FOR_LONG_BUTTON;
  const buttonLength = isLargeFrame ? styles.ioButtonLong : styles.ioButtonShort;
  const iconAdjustment = isLargeFrame ? styles.iconAdjustmentLong : styles.iconAdjustmentShort;
  const selectedStyle = selected ? styles.selected : "";

  return (
    <button
      className={`${styles.ioButton} ${buttonLength} ${selectedStyle}`}
      onClick={clickHandler}
      aria-label="Toggle IO information"
    >
      <span className={styles.ioLabel}>
        {isLargeFrame ? "IO " : ""}
        <span className={iconAdjustment}>
          <FontAwesomeIcon icon={faInfo} />
        </span>
      </span>
    </button>
  );
};

export const MuteButton: FunctionComponent<{
  clickHandler: () => void;
  muted: boolean;
}> = ({ clickHandler, muted }) => (
  <button className={styles.muteButton} onClick={clickHandler} aria-label={muted ? "Unmute audio" : "Mute audio"}>
    <FontAwesomeIcon icon={muted ? faVolumeMute : faVolumeUp} />
  </button>
);

// ============================================================================
// Right Buttons Component (Mute, Info, Help)
// ============================================================================

const RightButtons: FunctionComponent<{
  paneInstanceId: number;
  paneStateData: VideoPaneStateData;
  groupDimensions: number[];
}> = ({ paneInstanceId, paneStateData, groupDimensions }) => {
  const dispatch = useAppDispatch();
  const paneInstances = useAppSelector((state) => state.framework.paneInstances, deepEqual);
  const videos = useAppSelector((state) => state.videos, deepEqual);
  const source = useAppSelector((state) => state.framework.source, refEqual);
  const playheadDate = usePlayheadDate();

  const [appSeconds, setLocalAppSeconds] = useState(0);

  const downlinkNumber = paneStateData.channel + 1;
  const mtxPlaybackRecordsForDownlink = videos.mtxPlaybackAvailability[downlinkNumber];

  const videoPlayerType = determineVideoPlayerType({
    downlinkNumber,
    mtxPlaybackRecordsForDownlink,
    videos,
    date: playheadDate,
    appSeconds,
    source,
  });

  /**
   * Mute handling logic:
   * - When unmuting, make this pane the only unmuted video pane (mute all others)
   * - When muting, just mute this pane
   */
  const handleMuteButtonClick = () => {
    if (paneStateData.muted) {
      // Unmute this pane and mute all other video panes
      Object.entries(paneInstances).forEach(([key, value]) => {
        if (value.paneType.includes("video")) {
          const paneID = parseInt(key);
          dispatch(
            setPaneStateDataValue({
              paneInstanceId: paneID,
              paneStateProperty: "muted",
              paneStateValue: paneID !== paneInstanceId,
            })
          );
        }
      });
    } else {
      // Just mute this pane
      dispatch(
        setPaneStateDataValue({
          paneInstanceId,
          paneStateProperty: "muted",
          paneStateValue: true,
        })
      );
    }
  };

  const handleInfoToggle = () => {
    dispatch(
      setPaneStateDataValue({
        paneInstanceId,
        paneStateProperty: "showInfo",
        paneStateValue: !paneStateData.showInfo,
      })
    );
  };

  const handleHelpToggle = () => {
    dispatch(
      setPaneStateDataValue({
        paneInstanceId,
        paneStateProperty: "showHelp",
        paneStateValue: !paneStateData.showHelp,
      })
    );
  };

  return (
    <>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      <div className={styles.rightButtonsContainer}>
        <div className={styles.rightButtons}>
          {videoPlayerType === "IO" && (
            <>
              <div className={styles.verticalCenter}>
                <MuteButton clickHandler={handleMuteButtonClick} muted={paneStateData.muted} />
              </div>
              <div className={styles.verticalCenter}>
                <IOInfoButton
                  clickHandler={handleInfoToggle}
                  selected={paneStateData.showInfo}
                  groupDimensions={groupDimensions}
                />
              </div>
            </>
          )}
          <div className={styles.verticalCenter}>
            <HelpButton clickHandler={handleHelpToggle} selected={paneStateData.showHelp} />
          </div>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// Channel Selector and helpers
// ============================================================================

/**
 * Determines the button styling based on channel state.
 */
const getChannelButtonColor = (
  isAvailable: boolean,
  isSelected: boolean,
  isSelectedByOthers: boolean
): ColorVariant => {
  if (isSelected) {
    return isAvailable ? "active_selected" : "disabled_selected";
  }
  if (isAvailable && isSelectedByOthers) {
    return "active_other";
  }
  return isAvailable ? "active" : "disabled";
};

/**
 * Determines button corner rounding based on position.
 */
const getButtonRounding = (index: number, total: number): RoundedVariant => {
  if (index === 0) return "left";
  if (index === total - 1) return "right";
  return "none";
};

export const ChannelSelector: FunctionComponent<{
  paneInstanceId: number;
  channelAvailability: boolean[];
  paneStateData: VideoPaneStateData;
  groupDimensions: number[];
}> = ({ paneInstanceId, channelAvailability, paneStateData, groupDimensions }) => {
  const dispatch = useAppDispatch();

  // Get channels selected by other video panes
  const channelsSelectedByOthers = useAppSelector((state) => {
    const channels = new Set<number>();
    for (const [key, value] of Object.entries(state.framework.paneInstances)) {
      if (value.paneType.includes("video") && parseInt(key) !== paneInstanceId) {
        channels.add((value.paneStateData as VideoPaneStateData).channel);
      }
    }
    return channels;
  }, deepEqual);

  const handleChannelSelect = (channel: number) => {
    dispatch(
      setPaneStateDataValue({
        paneInstanceId,
        paneStateProperty: "channel",
        paneStateValue: channel,
      })
    );
  };

  return (
    <div className={styles.controls}>
      <div className={styles.selections} title="Select video downlink">
        {CHANNELS.map((channel) => (
          <Button
            key={`DLBUTTON_${channel}_${paneInstanceId}`}
            color={getChannelButtonColor(
              channelAvailability[channel],
              paneStateData.channel === channel,
              channelsSelectedByOthers.has(channel)
            )}
            size="small"
            rounded={getButtonRounding(channel, CHANNELS.length)}
            callback={() => handleChannelSelect(channel)}
          >
            <div className={styles.dlLabel}>{channel + 1}</div>
          </Button>
        ))}
      </div>
      <RightButtons
        paneInstanceId={paneInstanceId}
        paneStateData={paneStateData}
        groupDimensions={groupDimensions}
      />
    </div>
  );
};

// ============================================================================
// Pane Control Components
// ============================================================================

export const VideoDLPaneControls: FunctionComponent<{
  paneInstanceId: number;
  groupDimensions: number[];
}> = ({ paneInstanceId, groupDimensions }) => {
  const videos = useAppSelector((state) => state.videos, deepEqual);
  const playheadDate = usePlayheadDate();
  const playheadDateObj = new Date(playheadDate);
  const [appSeconds, setLocalAppSeconds] = useState(0);

  const mtxPlaybackAvailability = useAppSelector(
    (state) => state.videos.mtxPlaybackAvailability,
    deepEqual
  );
  const mtxHlsEndpoints = useAppSelector((state) => state.videos.mtxHlsEndpoints, deepEqual);
  const source = useAppSelector((state) => state.framework.source, refEqual);
  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as VideoPaneStateData,
    deepEqual
  );

  const visibleVideos = visibleVideosBySecond(videos.videoFiles, playheadDateObj);
  const liveEnabled = import.meta.env.VITE_PUBLIC_LIVE_STREAMS_ENABLED === "true";
  const channelAvailability = calculateChannelAvailability(
    playheadDate,
    appSeconds,
    visibleVideos,
    mtxPlaybackAvailability,
    mtxHlsEndpoints,
    source,
    liveEnabled
  );

  return (
    <>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      <ChannelSelector
        paneInstanceId={paneInstanceId}
        channelAvailability={channelAvailability}
        paneStateData={paneStateData}
        groupDimensions={groupDimensions}
      />
    </>
  );
};

export const VideoOtherPaneControls: FunctionComponent<{
  paneInstanceId: number;
  groupDimensions: number[];
}> = ({ paneInstanceId, groupDimensions }) => {
  const dispatch = useAppDispatch();
  const videos = useAppSelector((state) => state.videos, deepEqual);
  const playheadDate = usePlayheadDate();
  const playheadDateObj = new Date(playheadDate);
  const [appSeconds, setLocalAppSeconds] = useState(0);

  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as VideoPaneStateData,
    deepEqual
  );

  const videoFiles = videos.videoFiles;
  const visibleVideos = visibleVideosBySecond(videoFiles, playheadDateObj);

  const [nonDlVideoIDs, setNonDlVideoIDs] = useState<string[]>([]);

  const getPrettyVideoTitle = (videoID: string): string => {
    const video = videoFiles.find((v) => v.id === videoID);
    if (!video) return "";
    if (video.title?.trim()) return video.title;
    return `${cleanCollectionsString(video.collections)} - ${videoID}`;
  };

  useEffect(() => {
    setNonDlVideoIDs(visibleVideos.get(`${appSeconds}/-1`) || []);
  }, [visibleVideos, appSeconds]);

  const handleVideoSelect = (videoID: string) => {
    dispatch(
      setPaneStateDataValue({
        paneInstanceId,
        paneStateProperty: "channel",
        paneStateValue: -1,
      })
    );
    dispatch(
      setPaneStateDataValue({
        paneInstanceId,
        paneStateProperty: "activeVideoFileID",
        paneStateValue: videoID,
      })
    );
  };

  const hasVideosAvailable = nonDlVideoIDs.length > 0;
  const selectActiveStyle = hasVideosAvailable ? styles.selectActive : "";

  return (
    <>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      <div className={styles.controls}>
        <div
          className={`${styles.selectContainer} ${styles.selectContainerWide}`}
          title={getPrettyVideoTitle(paneStateData.activeVideoFileID)}
        >
          <select
            className={selectActiveStyle}
            value={paneStateData.activeVideoFileID}
            disabled={!hasVideosAvailable}
            onChange={(e) => handleVideoSelect(e.target.value)}
          >
            <option disabled={!hasVideosAvailable} value="">
              {hasVideosAvailable ? "Select Video" : "No other video at this time"}
            </option>
            {nonDlVideoIDs.map((v) => (
              <option value={v} key={v}>
                {getPrettyVideoTitle(v)}
              </option>
            ))}
          </select>
          <div className={styles.nonDlSelect_arrow}>
            <FontAwesomeIcon icon={faChevronDown} size="sm" />
          </div>
        </div>
        <RightButtons
          paneInstanceId={paneInstanceId}
          paneStateData={paneStateData}
          groupDimensions={groupDimensions}
        />
      </div>
    </>
  );
};
