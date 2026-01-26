import isNil from "lodash/isNil";
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
import { ModalDropdown } from "components/interface/dropdown-modal";

// ============================================================================
// Constants
// ============================================================================

const CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const MIN_WIDTH_FOR_LARGE_SELECTOR = 527;
const MIN_WIDTH_FOR_LONG_BUTTON = 470;

// ============================================================================
// Button Components
// ============================================================================

export const IOInfoButton: FunctionComponent<{
  clickHandler: () => void;
  selected?: boolean;
  frameDimensions: number[];
}> = ({ clickHandler, selected, frameDimensions }) => {
  const isLargeFrame = frameDimensions[0] > MIN_WIDTH_FOR_LONG_BUTTON;
  const buttonLength = isLargeFrame ? styles.ioButtonLong : styles.ioButtonShort;
  const iconAdjustment = isLargeFrame ? styles.iconAdjustmentLong : styles.iconAdjustmentShort;
  const selectedStyle = selected ? styles.selected : "";

  return (
    <button
      className={`${styles.ioButton} ${buttonLength} ${selectedStyle}`}
      onClick={clickHandler}
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
  <button className={styles.muteButton} onClick={clickHandler}>
    <FontAwesomeIcon icon={muted ? faVolumeMute : faVolumeUp} />
  </button>
);

// ============================================================================
// Right Buttons Component (Mute, Info, Help)
// ============================================================================

const RightButtons: FunctionComponent<{
  frameID: number;
  paneStateData: VideoPaneStateData;
  frameDimensions: number[];
}> = ({ frameID, paneStateData, frameDimensions }) => {
  const dispatch = useAppDispatch();
  const frames = useAppSelector((state) => state.framework.frames, deepEqual);
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
      Object.entries(frames).forEach(([key, value]) => {
        if (value.paneType.includes("video")) {
          const paneID = parseInt(key);
          dispatch(
            setPaneStateDataValue({
              frameID: paneID,
              paneStateProperty: "muted",
              paneStateValue: paneID !== frameID,
            })
          );
        }
      });
    } else {
      // Just mute this pane
      dispatch(
        setPaneStateDataValue({
          frameID,
          paneStateProperty: "muted",
          paneStateValue: true,
        })
      );
    }
  };

  const handleInfoToggle = () => {
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: "showInfo",
        paneStateValue: !paneStateData.showInfo,
      })
    );
  };

  const handleHelpToggle = () => {
    dispatch(
      setPaneStateDataValue({
        frameID,
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
                  frameDimensions={frameDimensions}
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
// Channel Selector Helpers
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

const getDropdownButtonRounding = (index: number, total: number): RoundedVariant => {
  if (index === 0) return "top";
  if (index === total - 1) return "bottom";
  return "none";
};

// ============================================================================
// Channel Selector Components
// ============================================================================

export const ChannelSelectorLarge: FunctionComponent<{
  frameID: number;
  channelAvailability: boolean[];
  paneStateData: VideoPaneStateData;
  frameDimensions: number[];
}> = ({ frameID, channelAvailability, paneStateData, frameDimensions }) => {
  const dispatch = useAppDispatch();

  // Get channels selected by other video panes
  const channelsSelectedByOthers = useAppSelector((state) => {
    const channels = new Set<number>();
    for (const [key, value] of Object.entries(state.framework.frames)) {
      if (value.paneType.includes("video") && parseInt(key) !== frameID) {
        channels.add((value.paneStateData as VideoPaneStateData).channel);
      }
    }
    return channels;
  }, deepEqual);

  const handleChannelSelect = (channel: number) => {
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: "channel",
        paneStateValue: channel,
      })
    );
  };

  return (
    <div className={styles.controls}>
      <div className={styles.selections}>
        {CHANNELS.map((channel) => (
          <Button
            key={`DLBUTTON_${channel}_${frameID}`}
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
        frameID={frameID}
        paneStateData={paneStateData}
        frameDimensions={frameDimensions}
      />
    </div>
  );
};

interface ChannelDropdownModalOptions {
  frameID: number;
  channelAvailability: boolean[];
  channelSelected: number;
}

const ChannelDropdownLabel: FunctionComponent<{
  dlNumber: number;
  isAvailable: boolean;
}> = ({ dlNumber, isAvailable }) => {
  const color = isAvailable ? "active_selected" : "disabled_selected";

  return (
    <div className={`${styles.chDropdownLabel} ${styles[color]}`}>
      <div className={styles.verticalCenter}>{dlNumber + 1}</div>
    </div>
  );
};

const ChannelDropdownModal: FunctionComponent<{
  closeClick?: () => void;
  options?: ChannelDropdownModalOptions;
}> = ({ closeClick, options }) => {
  const frameID = options?.frameID ?? 0;
  const channelAvailability = options?.channelAvailability ?? [];
  const channelSelected = options?.channelSelected ?? 0;
  const dispatch = useAppDispatch();

  // Get channels selected by other video panes
  const channelsSelectedByOthers = useAppSelector((state) => {
    const channels = new Set<number>();
    for (const [key, value] of Object.entries(state.framework.frames)) {
      if (value.paneType.includes("video") && parseInt(key) !== frameID) {
        channels.add((value.paneStateData as VideoPaneStateData).channel);
      }
    }
    return channels;
  }, deepEqual);

  const handleSelectChannel = (channel: number) => {
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: "channel",
        paneStateValue: channel,
      })
    );
    closeClick?.();
  };

  if (!channelAvailability) return null;

  return (
    <div className={styles.chDropdownModal}>
      {CHANNELS.map((channel) => (
        <div
          key={`CHANNEL__PICKER__${frameID}__${channel}`}
          onClick={() => handleSelectChannel(channel)}
        >
          <Button
            color={getChannelButtonColor(
              channelAvailability[channel],
              channelSelected === channel,
              channelsSelectedByOthers.has(channel)
            )}
            size="small"
            rounded={getDropdownButtonRounding(channel, CHANNELS.length)}
          >
            <div className={styles.dlLabel}>{channel + 1}</div>
          </Button>
        </div>
      ))}
    </div>
  );
};

export const ChannelSelectorSmall: FunctionComponent<{
  frameID: number;
  channelAvailability: boolean[];
  paneStateData: VideoPaneStateData;
  frameDimensions: number[];
}> = ({ frameID, channelAvailability, paneStateData, frameDimensions }) => (
  <div className={styles.controls}>
    <div className={styles.dropdown}>
      <ModalDropdown
        color="grey"
        size="skinny"
        modal={ChannelDropdownModal}
        modalOptions={{ frameID, channelAvailability, channelSelected: paneStateData?.channel }}
      >
        {!isNil(channelAvailability) ? (
          <ChannelDropdownLabel
            dlNumber={paneStateData.channel}
            isAvailable={channelAvailability[paneStateData.channel]}
          />
        ) : (
          <>&nbsp;DL</>
        )}
      </ModalDropdown>
    </div>
    <RightButtons
      frameID={frameID}
      paneStateData={paneStateData}
      frameDimensions={frameDimensions}
    />
  </div>
);

// ============================================================================
// Pane Control Components
// ============================================================================

export const VideoDLPaneControls: FunctionComponent<{
  frameID: number;
  frameDimensions: number[];
}> = ({ frameID, frameDimensions }) => {
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
    (state) => state.framework.frames[frameID].paneStateData as VideoPaneStateData,
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

  const ChannelSelector =
    frameDimensions[0] < MIN_WIDTH_FOR_LARGE_SELECTOR ? ChannelSelectorSmall : ChannelSelectorLarge;

  return (
    <>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      <ChannelSelector
        frameID={frameID}
        channelAvailability={channelAvailability}
        paneStateData={paneStateData}
        frameDimensions={frameDimensions}
      />
    </>
  );
};

export const VideoOtherPaneControls: FunctionComponent<{
  frameID: number;
  frameDimensions: number[];
}> = ({ frameID, frameDimensions }) => {
  const dispatch = useAppDispatch();
  const videos = useAppSelector((state) => state.videos, deepEqual);
  const playheadDate = usePlayheadDate();
  const playheadDateObj = new Date(playheadDate);
  const [appSeconds, setLocalAppSeconds] = useState(0);

  const paneStateData = useAppSelector(
    (state) => state.framework.frames[frameID].paneStateData as VideoPaneStateData,
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
        frameID,
        paneStateProperty: "channel",
        paneStateValue: -1,
      })
    );
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: "activeVideoFileID",
        paneStateValue: videoID,
      })
    );
  };

  const hasVideosAvailable = nonDlVideoIDs.length > 0;
  const selectActiveStyle = hasVideosAvailable ? styles.selectActive : "";
  const dropDownWidthClass =
    frameDimensions[0] > MIN_WIDTH_FOR_LARGE_SELECTOR
      ? styles.selectContainerWide
      : styles.selectContainerNarrow;

  return (
    <>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      <div className={styles.controls}>
        <div
          className={`${styles.selectContainer} ${dropDownWidthClass}`}
          title={getPrettyVideoTitle(paneStateData.activeVideoFileID)}
        >
          <select
            className={selectActiveStyle}
            value={paneStateData.activeVideoFileID}
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
          frameID={frameID}
          paneStateData={paneStateData}
          frameDimensions={frameDimensions}
        />
      </div>
    </>
  );
};
