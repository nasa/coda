import { FunctionComponent, MutableRefObject, useEffect, useRef, useState } from "react";
import type { RootState } from "store/index";
import { appSecondsFromDateString, dateFromAppSeconds } from "utils/formatting";
import styles from "./video.module.css";
import { setPaneStateValue } from "store/framework";
import HelpOverlay from "components/interface/pane-help-overlay";
import { isAutoplayError } from "./video";
import { isSameDate } from "utils/date";
import isEqual from "lodash/isEqual";
import { useAppDispatch } from "utils/useAppDispatch";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { usePlayheadContext } from "store/contextProviders/playheadContext";

const VideoMTXPlaybackPane: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const dispatch = useAppDispatch();

  const paneStateData: VideoPaneStateData = useAppSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );
  const source = useAppSelector((state: RootState) => state.framework.source, refEqual);
  const mtxPlaybackRecordsForDownlink = useAppSelector((state: RootState) => {
    const downlinkNumber = (state.framework.frames[frameID].paneStateData.channel + 1).toString();
    return state.videos.mtxPlaybackAvailability[downlinkNumber] || [];
  }, deepEqual);
  const videoRef = useRef() as MutableRefObject<HTMLVideoElement>;

  const [status, setStatus] = useState(null);
  const [currVidMTXPlaybackRecord, setCurrVidMTXPlaybackRecord] = useState(null);
  const [lastURLStartTime, setLastURLStartTime] = useState(null);

  const { playhead } = usePlayheadContext();

  const playOrPause = () => {
    const asyncFunc = async () => {
      try {
        if (playhead.isRunning) {
          // make sure the video is playing when the playhead is running
          // if the video source is "", trying to play will "unload" the video and we'll show a poster instead
          await videoRef.current.play();
        } else if (!playhead.isRunning) {
          // make sure the video is paused when the playhead isn't running
          await videoRef.current.pause();
        }
      } catch (e: unknown) {
        if (isAutoplayError(e)) {
          // the browser is preventing autoplay of unmuted videos. so let's just mute the video. on the next playhead tick, we'll try to play again
          setPaneStateValue(dispatch, frameID, "muted", true);
        }
      }
    };
    asyncFunc();
  };

  const getMtxPlaybackRecordForPlayhead = (appSeconds: number): MtxRecordingTimeRange => {
    for (const mtxPlaybackRecord of mtxPlaybackRecordsForDownlink) {
      // check that the mtxPlaybackRecord is for today. Remember that these records were modifed
      // when they were fetched to look like they started at midnight if they started before today
      if (!isSameDate(new Date(mtxPlaybackRecord.start), new Date(playhead.date))) continue;

      const mtxDlStartAppSeconds = appSecondsFromDateString(mtxPlaybackRecord.start);
      if (
        appSeconds >= mtxDlStartAppSeconds &&
        appSeconds < mtxDlStartAppSeconds + mtxPlaybackRecord.duration
      ) {
        return mtxPlaybackRecord;
      }
    }
    return null;
  };

  const playVideoAtPlayhead = (mtxRecordingTimeRange: MtxRecordingTimeRange) => {
    if (!mtxRecordingTimeRange) return;
    // add x seconds to counteract the delay in the video starting
    const playheadStart = dateFromAppSeconds(playhead.appSeconds + 2, playhead.date)
      .toISOString()
      .replace(/.000Z/, "Z");

    const mtxRecordingsBaseUrl = import.meta.env.VITE_PUBLIC_MEDIA_MTX_RECORDINGS_URL;
    const sourceAbbr = source === "ISS" ? "ISS" : "TE";
    const channel = (paneStateData.channel + 1).toString();
    const path = `DL${channel}_${sourceAbbr}`;

    const url = new URL("get", mtxRecordingsBaseUrl);
    url.searchParams.append("path", path);
    url.searchParams.append("start", playheadStart);
    url.searchParams.append("duration", mtxRecordingTimeRange.duration.toString());
    setLastURLStartTime(playheadStart);
    videoRef.current.src = url.toString();
    videoRef.current.load();
  };

  const selectAndLoadVideo = () => {
    if (!videoRef.current) return;

    // if there is MTX video available, use the MTX playback video pane
    if (currVidMTXPlaybackRecord) {
      // there's a video already loaded, so let's make sure it's still the right video
      const currVidStartSeconds = appSecondsFromDateString(currVidMTXPlaybackRecord.start);
      if (
        playhead.appSeconds < currVidStartSeconds ||
        playhead.appSeconds >= currVidStartSeconds + currVidMTXPlaybackRecord.duration
      ) {
        // the current video is no longer available
        setCurrVidMTXPlaybackRecord(null);
      }
    } else {
      // find the video that is available for the current playhead
      const mtxPlaybackRecord = getMtxPlaybackRecordForPlayhead(playhead.appSeconds);
      setCurrVidMTXPlaybackRecord(mtxPlaybackRecord);
      playVideoAtPlayhead(mtxPlaybackRecord);
    }
  };

  const syncToPlayhead = () => {
    // bail if no video element is loaded
    if (!videoRef.current || !currVidMTXPlaybackRecord) return;

    const { currentTime: currentVidSeconds } = videoRef.current;

    // figure out what the appSeconds is of the current video playhead
    const lastUrlStartTimeAppSeconds = appSecondsFromDateString(lastURLStartTime);
    const videoPlaySeconds = lastUrlStartTimeAppSeconds + currentVidSeconds;

    // playback is off by > x seconds, so we need to assemble a new MTX URL with the correct start time
    if (Math.abs(playhead.appSeconds - videoPlaySeconds) < 10) return;

    const mtxPlaybackRecord = getMtxPlaybackRecordForPlayhead(playhead.appSeconds);
    if (isEqual(mtxPlaybackRecord, currVidMTXPlaybackRecord)) {
      setCurrVidMTXPlaybackRecord(mtxPlaybackRecord);
    }
    playVideoAtPlayhead(mtxPlaybackRecord);
  };

  useEffect(selectAndLoadVideo, [mtxPlaybackRecordsForDownlink, playhead.appSeconds]);
  useEffect(syncToPlayhead, [
    playhead.appSeconds,
    currVidMTXPlaybackRecord,
    mtxPlaybackRecordsForDownlink,
  ]);
  useEffect(playOrPause, [playhead.isRunning, playhead.appSeconds]);

  const toggleFullScreen = () => {
    const el = videoRef.current;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  return (
    <div
      key={`video_element__${frameID}`}
      className={styles.vidContainer}
      data-frame-id={"MTX Player"}
    >
      {status === "buffering" ? (
        <>
          <div className={styles.playerPosterNovid}></div>
          <div className={styles.playerPosterBuffering}>
            <div className={styles.loaderAnimation}></div>
          </div>
        </>
      ) : null}
      <video
        ref={videoRef}
        className={styles.player}
        onCanPlay={() => {
          if (!paneStateData.ready) {
            setPaneStateValue(dispatch, frameID, "ready", true);
          }
        }}
        onEnded={() => {
          // ready up because we don't want a missing video to hold up the playhead
          setPaneStateValue(dispatch, frameID, "ready", true);
          setStatus(null);
        }}
        onWaiting={() => {
          if (paneStateData.ready) {
            setPaneStateValue(dispatch, frameID, "ready", false);
            setStatus("buffering");
          }
        }}
        onPlaying={() => {
          setStatus("playing");
        }}
        onError={(e) => {
          const vidElement = e.target as HTMLVideoElement;
          if (!vidElement.error.message.includes("mpty")) {
            //if not 'src attribute is empty' - this eliminates raising an IO error on empty src
            setStatus("error");
            console.error(
              `video ${frameID} has thrown an error ${vidElement.error.code} - ${vidElement.error.message}`
            );
          } else {
            setStatus("novid");
          }
          //unblocking playhead
          if (paneStateData.ready !== true) {
            setPaneStateValue(dispatch, frameID, "ready", true);
          }
        }}
        onClick={() => {
          if (paneStateData.activeVideoFileID !== "") {
            toggleFullScreen();
          }
        }}
      />

      <HelpOverlay
        isModalOpen={paneStateData.showHelp}
        closeHandler={() => {
          setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
        }}
      >
        <div>
          <p>
            Displays videos recorded from an EMSS livestream recorder, synced to CODA's playback
            time. Video only temporarily available for playback and is deleted as time progresses.
          </p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default VideoMTXPlaybackPane;
