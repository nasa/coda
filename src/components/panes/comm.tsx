import { HelpButton } from "components/interface/pane-help-control-button";
import { FunctionComponent, useEffect, useMemo, useRef, useState } from "react";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { setPaneStateDataValue } from "store/framework";
import styles from "./comm.module.css";
import HelpOverlay from "components/interface/pane-help-overlay";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleXmark,
  faLock,
  faLockOpen,
  faKey,
  faFilter,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import { usePlayheadDate } from "store/hooks";
import { MuteButton } from "components/panes/video/video-controls";
import { setAppSeconds } from "store/clock";
import { dateFromAppSeconds } from "utils/formatting";
import ClockInterval from "components/framework/ClockInterval";
import TalkybotConnectionNotice from "./talkybotConnectionNotice";

export const channelColors = [
  "#653939",
  "#2c4056",
  "#344529",
  "#42304d",
  "#705143",
  "#345E60",
  "#243477",
  "#585858",
  "#4A4325",
  "#85732B",
];

type ChannelAudioTiming = {
  file: TbAudioFileConverted;
  startSeconds: number;
  endSeconds: number;
  timeLabel: string;
};

/** Precompute channel timings to avoid repeated date/appSeconds conversions */
function buildChannelTimingMap(
  audioFiles: TbAudioFileConverted[] = []
): Map<string, ChannelAudioTiming[]> {
  const channelMap = new Map<string, ChannelAudioTiming[]>();

  for (const file of audioFiles) {
    const timings = channelMap.get(file.channel) ?? [];

    const timeLabel = new Date(file.startTime).toISOString().substring(11, 19) ?? "";

    timings.push({
      file,
      startSeconds: file.appSeconds ?? 0,
      endSeconds: (file.appSeconds ?? 0) + file.duration,
      timeLabel,
    });

    channelMap.set(file.channel, timings);
  }

  return channelMap;
}

export const CommControls: FunctionComponent<{
  paneInstanceId: number;
  groupDimensions: number[];
}> = ({ paneInstanceId, groupDimensions }) => {
  const dispatch = useAppDispatch();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const minWidth = 480; // minimum width of the transcript pane before breaking into dropdown for downlinks

  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as CommPaneStateData,
    deepEqual
  );
  const audioFiles = useAppSelector((state) => state.talkybot.audioFiles, deepEqual);

  const channelTimingMap = useMemo(() => buildChannelTimingMap(audioFiles), [audioFiles]);

  // Derive unique channels from audio files (e.g., "1-SG-1", "1-SG-2", etc.)
  const availableChannels = useMemo(() => {
    const channels = Array.from(channelTimingMap.keys());
    channels.sort();
    return channels;
  }, [channelTimingMap]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleChannel = (channel: string) => {
    const currentChannels = paneStateData.sgChannels || [];
    const currentUnselected = paneStateData.unselectedSgChannels || [];
    if (currentChannels.includes(channel)) {
      dispatch(
        setPaneStateDataValue({
          paneInstanceId,
          paneStateProperty: "sgChannels",
          paneStateValue: currentChannels.filter((c) => c !== channel),
        })
      );
      if (!currentUnselected.includes(channel)) {
        dispatch(
          setPaneStateDataValue({
            paneInstanceId,
            paneStateProperty: "unselectedSgChannels",
            paneStateValue: [...currentUnselected, channel],
          })
        );
      }
    } else {
      dispatch(
        setPaneStateDataValue({
          paneInstanceId,
          paneStateProperty: "sgChannels",
          paneStateValue: [...currentChannels, channel],
        })
      );
      if (currentUnselected.includes(channel)) {
        dispatch(
          setPaneStateDataValue({
            paneInstanceId,
            paneStateProperty: "unselectedSgChannels",
            paneStateValue: currentUnselected.filter((c) => c !== channel),
          })
        );
      }
    }
  };

  const buttonLength = groupDimensions[0] > minWidth ? styles.buttonLong : styles.buttonShort;
  let lockButtonSelected = "";
  if (paneStateData?.lockScroll) {
    lockButtonSelected = styles.buttonSelected;
  }
  let filterButtonSelected = "";
  if (paneStateData?.filterActive) {
    filterButtonSelected = styles.buttonSelected;
  }

  const selectedCount = availableChannels.filter((channel) =>
    paneStateData.sgChannels.includes(channel)
  ).length;
  const totalCount = availableChannels.length;

  const controlsLeft = () => {
    if (availableChannels.length === 0) {
      return <div className={styles.selections}>No channels</div>;
    }

    return (
      <div className={styles.channelDropdown} ref={dropdownRef}>
        <button
          className={styles.channelDropdownButton}
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <span>
            {selectedCount === totalCount
              ? "Channels"
              : selectedCount === 0
                ? "No Channels"
                : `${selectedCount} Channel${selectedCount > 1 ? "s" : ""}`}
          </span>
        </button>
        <div className={styles.channelDropdownArrow}>
          <FontAwesomeIcon icon={faChevronDown} size="sm" />
        </div>
        {dropdownOpen && (
          <div className={styles.channelDropdownMenu}>
            {availableChannels.map((channel, index) => (
              <div
                key={channel}
                className={styles.channelDropdownItem}
                onClick={() => toggleChannel(channel)}
                style={{ backgroundColor: channelColors[index % channelColors.length] }}
              >
                <input
                  type="checkbox"
                  checked={paneStateData.sgChannels?.includes(channel) || false}
                  onChange={() => toggleChannel(channel)}
                  onClick={(e) => e.stopPropagation()}
                />
                <label>
                  {channel}{" "}
                  {channelTimingMap.get(channel)?.[0]?.file.restricted && (
                    <FontAwesomeIcon icon={faKey} title="Restricted channel" />
                  )}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}>{controlsLeft()}</div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <MuteButton
            clickHandler={() => {
              dispatch(
                setPaneStateDataValue({
                  paneInstanceId,
                  paneStateProperty: "isMuted",
                  paneStateValue: !paneStateData.isMuted,
                })
              );
            }}
            muted={paneStateData.isMuted}
          />
        </div>
        <div className={styles.verticalCenter}>
          <button
            className={`${styles.filterButton} ${buttonLength} ${filterButtonSelected}`}
            title={`Filter utterances by words`}
            onClick={() => {
              dispatch(
                setPaneStateDataValue({
                  paneInstanceId,
                  paneStateProperty: "filterActive",
                  paneStateValue: !paneStateData.filterActive,
                })
              );
            }}
          >
            {groupDimensions[0] > minWidth ? (
              <span className={styles.buttonLabel}>
                <div>{groupDimensions[0] > minWidth ? "Filter" : ""}</div>
                <div>
                  <FontAwesomeIcon icon={faFilter} size="sm" />
                </div>
              </span>
            ) : (
              <FontAwesomeIcon icon={faFilter} size="sm" />
            )}
          </button>
        </div>
        <div className={styles.verticalCenter}>
          <button
            className={`${styles.lockButton} ${buttonLength} ${lockButtonSelected}`}
            title={`Scroll automatically to the last spoken utterance`}
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

const ChannelAudioPlayer: FunctionComponent<{
  src: string | undefined;
  offset: number;
  playing: boolean;
}> = ({ src, offset, playing }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    audio.src = src;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (!playing || Math.abs(audio.currentTime - offset) > 1) {
      audio.currentTime = offset;
    }
    if (playing && audio.paused) void audio.play().catch(() => {});
    if (!playing) audio.pause();
  }, [src, offset, playing]);

  return <audio ref={audioRef} />;
};

/** Represents a processed utterance for display */
type DisplayUtterance = {
  id: string;
  secs: number;
  time: string;
  text: string;
  textOriginalLanguage?: string;
  duration: number;
  channel: string;
};

const CommPane: FunctionComponent<{ paneInstanceId: number }> = ({ paneInstanceId }) => {
  const audioFiles = useAppSelector((state) => state.talkybot.audioFiles, deepEqual);
  const talkybotMetadata = useAppSelector((state) => state.talkybot.metadata, deepEqual);
  const hasAudioFiles = audioFiles && audioFiles.length > 0;
  const channelTimingMap = useMemo(() => buildChannelTimingMap(audioFiles), [audioFiles]);

  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as CommPaneStateData,
    deepEqual
  );

  // Derive available channels here (not only in CommControls) so that the
  // auto-select effect below always runs, even when the header controls are
  // in collapsed mode and CommControls is not mounted.
  const availableChannels = useMemo(() => {
    const channels = Array.from(channelTimingMap.keys());
    channels.sort();
    return channels;
  }, [channelTimingMap]);

  // Auto-select any newly available channel the user hasn't explicitly
  // unselected. Must live in CommPane (not only CommControls) because the
  // header controls may be collapsed (not mounted) on narrow panels loaded via
  // a share link — the race condition that caused utterances to stay hidden.
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (availableChannels.length === 0) return;
    const unselected = paneStateData.unselectedSgChannels || [];
    const toAdd = availableChannels.filter(
      (c) => !paneStateData.sgChannels.includes(c) && !unselected.includes(c)
    );
    if (toAdd.length > 0) {
      dispatch(
        setPaneStateDataValue({
          paneInstanceId,
          paneStateProperty: "sgChannels",
          paneStateValue: [...paneStateData.sgChannels, ...toAdd],
        })
      );
    }
  }, [
    availableChannels,
    paneStateData.sgChannels,
    paneStateData.unselectedSgChannels,
    dispatch,
    paneInstanceId,
  ]);
  // Transcript state
  const [filterText, setFilterText] = useState("");

  // Clock state from Redux
  const playheadDate = usePlayheadDate();
  const isRunning = useAppSelector((state) => state.clock.isRunning, refEqual);
  const [appSeconds, setLocalAppSeconds] = useState(0);

  const activeUtteranceRef = useRef<HTMLDivElement>(null);
  const lastProcessedMetadataRef = useRef<FetchMetadata | null>(null);

  // Get all timings for selected channels, merged and sorted by time
  const allChannelTimings = useMemo(() => {
    const selectedChannels = paneStateData.sgChannels || [];
    if (selectedChannels.length === 0) {
      return [];
    }
    const timings: ChannelAudioTiming[] = [];
    for (const channel of selectedChannels) {
      const channelData = channelTimingMap.get(channel) ?? [];
      timings.push(...channelData);
    }
    // Sort by start time
    timings.sort((a, b) => a.startSeconds - b.startSeconds);
    return timings;
  }, [channelTimingMap, paneStateData.sgChannels]);

  // Convert audio files to display utterances (each audio file has text/transcript)
  const utterances = useMemo((): DisplayUtterance[] => {
    return allChannelTimings.map((timing) => ({
      id: timing.file.fileUuid,
      secs: timing.startSeconds,
      time: timing.timeLabel,
      text: timing.file.text || "",
      textOriginalLanguage: timing.file?.textOriginalLanguage,
      duration: timing.file.duration,
      channel: timing.file.channel,
    }));
  }, [allChannelTimings]);

  // Derive filtered utterances from utterances and filter criteria
  const filteredUtterances = useMemo((): DisplayUtterance[] => {
    if (!utterances.length) {
      return [];
    }
    if (paneStateData.filterActive && filterText !== "") {
      return utterances.filter((utterance) => {
        return utterance.text.toLowerCase().includes(filterText.toLowerCase());
      });
    }
    return utterances;
  }, [utterances, paneStateData.filterActive, filterText]);

  // Find the most recent utterance that has started (accounting for ClockInterval's Math.floor)
  const activeUtteranceSecs = useMemo((): number => {
    if (!filteredUtterances.length) {
      return 0;
    }

    // Find the last utterance where floor(utterance.secs) <= appSeconds
    // ClockInterval floors appSeconds, so we floor utterance times for comparison
    let activeUtterance = filteredUtterances[0];

    for (const utterance of filteredUtterances) {
      if (Math.floor(utterance.secs) <= appSeconds) {
        activeUtterance = utterance;
      }
    }

    return activeUtterance.secs;
  }, [appSeconds, filteredUtterances]);

  // Scroll to the active utterance when scroll lock is enabled, but only when
  // the active utterance changes — not on every clock tick.
  useEffect(() => {
    if (
      !paneStateData.lockScroll ||
      activeUtteranceRef.current === null ||
      activeUtteranceSecs <= 0
    ) {
      return;
    }

    activeUtteranceRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeUtteranceSecs, paneStateData.lockScroll]);

  // Set initial help state based on audio file presence when metadata loads
  useEffect(() => {
    // Only run if we have metadata and haven't processed this specific metadata update yet
    if (talkybotMetadata && lastProcessedMetadataRef.current !== talkybotMetadata) {
      lastProcessedMetadataRef.current = talkybotMetadata;

      // Auto-open help if no files, auto-close if files exist
      // This resets the help state only when new data arrives
      dispatch(
        setPaneStateDataValue({
          paneInstanceId,
          paneStateProperty: "showHelp",
          paneStateValue: talkybotMetadata.success && !hasAudioFiles,
        })
      );
    }
  }, [talkybotMetadata, hasAudioFiles, dispatch, paneInstanceId]);

  // Get sorted channels for consistent color mapping
  const sortedChannels = useMemo(() => {
    const channels = Array.from(channelTimingMap.keys());
    channels.sort();
    return channels;
  }, [channelTimingMap]);

  // Estimate a consistent label width from the longest channel name, capped at 115px
  const channelLabelWidth = useMemo(() => {
    if (!sortedChannels.length) return 60;
    const longest = Math.max(...sortedChannels.map((ch) => ch.length));
    // ~8px per uppercase char at 0.9em, plus ~8px horizontal padding
    return Math.min(115, longest * 8 + 8);
  }, [sortedChannels]);

  function displayUtterance(utterance: DisplayUtterance, idx: number) {
    let uttClass = "";
    if (idx % 2 !== 0) {
      uttClass = styles.utteranceColorAlt;
    }

    const activeRefOnly = utterance.secs === activeUtteranceSecs ? { ref: activeUtteranceRef } : {};
    const activeUtteranceStyle =
      utterance.secs === activeUtteranceSecs ? styles.activeUtterance : "";

    // Show typing indicator for utterances being captured (empty text with zero duration)
    const isCapturing = utterance.text === "" && utterance.duration === 0;
    const content = isCapturing ? (
      <div className={styles.typingIndicator}>
        <span></span>
        <span></span>
        <span></span>
      </div>
    ) : (
      <>
        <span className={styles.utteranceTextMain}>{utterance.text}</span>
        {utterance.textOriginalLanguage && (
          <span className={styles.utteranceTextOriginal}>{utterance.textOriginalLanguage}</span>
        )}
      </>
    );

    // Get color based on channel's position in sorted list
    const channelIndex = sortedChannels.indexOf(utterance.channel);
    const channelColor = channelColors[channelIndex % channelColors.length];

    return (
      <div
        className={`${styles.utterance} ${uttClass} ${activeUtteranceStyle}`}
        key={utterance.id}
        {...activeRefOnly}
        onClick={() => {
          dispatch(setAppSeconds(utterance.secs));
        }}
      >
        <div className={styles.channelTime}>
          <div
            className={styles.channelLabel}
            style={{ backgroundColor: channelColor, width: channelLabelWidth }}
          >
            {utterance.channel}
            <div className={styles.time}>{utterance.time}</div>
          </div>
        </div>
        <div className={styles.utteranceText}>{content}</div>
      </div>
    );
  }

  const displayFilterStyle = paneStateData.filterActive
    ? styles.filterSearch
    : styles.filterSearchHidden;

  const issRealtimeDate =
    playheadDate && !Number.isNaN(new Date(playheadDate).valueOf())
      ? dateFromAppSeconds(appSeconds ?? 0, playheadDate)
      : null;
  const dateTimeString =
    issRealtimeDate && !Number.isNaN(issRealtimeDate.valueOf())
      ? issRealtimeDate.toISOString().split(".")[0].replace("Z", "")
      : "";

  return (
    <div className={styles.main}>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      <TalkybotConnectionNotice />
      <div className={displayFilterStyle}>
        <div className={styles.inputBoxContainer}>
          <input
            type="text"
            name="filterField"
            placeholder="Text to filter for"
            value={filterText}
            className={styles.inputBox}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <div className={styles.verticalCenter}>
            <div
              className={styles.icon}
              onClick={() => {
                setFilterText("");
                dispatch(
                  setPaneStateDataValue({
                    paneInstanceId,
                    paneStateProperty: "filterActive",
                    paneStateValue: false,
                  })
                );
              }}
            >
              <FontAwesomeIcon icon={faCircleXmark} size="lg" />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.player}>
        {availableChannels
          .filter((channel) => paneStateData.sgChannels.includes(channel))
          .map((channel) => {
            const clip = channelTimingMap
              .get(channel)
              ?.find(
                ({ file, startSeconds, endSeconds }) =>
                  (!file.override || file.audioUrl) &&
                  startSeconds <= appSeconds &&
                  appSeconds < endSeconds
              );
            const src =
              clip && !paneStateData.isMuted
                ? (clip.file.audioUrl ??
                  `/api/v1/restricted/talkybot/audio/${encodeURIComponent(clip.file.fileUuid)}`)
                : undefined;
            return (
              <ChannelAudioPlayer
                key={channel}
                src={src}
                offset={clip ? appSeconds - clip.startSeconds : 0}
                playing={isRunning}
              />
            );
          })}
      </div>
      <div className={styles.utterancesContainer}>
        <div>{filteredUtterances.map((utterance, idx) => displayUtterance(utterance, idx))}</div>
      </div>
      <HelpOverlay
        isModalOpen={paneStateData.showHelp && talkybotMetadata?.success !== false}
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
        <div className={styles.helpContent}>
          <div className={styles.helpHeader}>
            <div className={styles.helpTitleRow}>
              <img
                src="/images/talky-the-bot.svg"
                alt="Talky Bot mascot"
                className={styles.helpMascot}
              />
              <h3 className={styles.helpTitle}>Talky Bot</h3>
            </div>
            <p className={styles.helpSubtitle}>Space-to-Ground Communications</p>
          </div>
          <div className={styles.helpBody}>
            <p>
              Audio and transcripts are provided by our sister project,{" "}
              <a href="https://talkybot.fit.nasa.gov/" target="_blank" rel="noopener noreferrer">
                EMSS Talky Bot
              </a>
            </p>
            <p>
              We plan to back-fill Talky Bot with comm dating back to 2011. Until then if you're
              visiting a date where audio is missing, you can find comm for historical dates on our
              other sister project:
            </p>
            <a
              href={`https://issinrealtime.org/${dateTimeString}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.helpCallout}
            >
              <img
                src="/images/ISSiRT.png"
                alt="ISS in Real Time"
                className={styles.helpCalloutIcon}
              />
              <div className={styles.helpCalloutContent}>
                <span className={styles.helpCalloutTitle}>ISS in Real Time</span>
                <span className={styles.helpCalloutSubtext}>Opens to current CODA date/time</span>
              </div>
            </a>
            <h4>Controls</h4>
            <ul>
              <li>
                <strong>Channels:</strong> Select S/G channels via dropdown
              </li>
              <li>
                <strong>Filter:</strong> Search for specific text in transcripts
              </li>
              <li>
                <strong>Scroll Lock:</strong> Auto-scroll to latest utterance
              </li>
            </ul>
            <p className={styles.helpTip}>
              💡 Click on any utterance to jump to that moment in playback.
            </p>
          </div>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default CommPane;
