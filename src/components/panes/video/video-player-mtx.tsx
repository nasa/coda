import { FunctionComponent, useCallback, useEffect, useRef, useState } from "react";
import { appSecondsFromDateString, dateFromAppSeconds } from "utils/formatting";
import styles from "./video-player-mtx.module.css";
import { setPaneStateDataValue } from "store/framework";
import HelpOverlay from "components/interface/pane-help-overlay";
import { VideoMTXHelpContent } from "./video-help";
import { isAutoplayError, getSourceSuffix } from "utils/video";
import { isSameDate } from "utils/date";
import isEqual from "lodash/isEqual";
import { useAppDispatch } from "utils/useAppDispatch";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import ClockInterval from "components/framework/ClockInterval";
import { usePlayheadDate } from "store/hooks";

const VideoMTXPlaybackPane: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const dispatch = useAppDispatch();

  const paneStateData = useAppSelector(
    (state) => state.framework.frames[frameID].paneStateData as VideoPaneStateData,
    deepEqual
  );
  const source = useAppSelector((state) => state.framework.source, refEqual);
  const mtxPlaybackRecordsForDownlink = useAppSelector((state) => {
    const downlinkNumber = (
      (state.framework.frames[frameID].paneStateData as VideoPaneStateData).channel + 1
    ).toString();
    return state.videos.mtxPlaybackAvailability[downlinkNumber] || [];
  }, deepEqual);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [currVidMTXPlaybackRecord, setCurrVidMTXPlaybackRecord] =
    useState<MTXRecordingTimeRange | null>(null);
  const [currChannel, setCurrChannel] = useState<number | null>(null);

  const [lastURLStartTime, setLastURLStartTime] = useState<string | null>(null);

  const isRunning = useAppSelector((state) => state.clock.isRunning, refEqual);
  const playheadDate = usePlayheadDate();
  const [appSeconds, setLocalAppSeconds] = useState(0);

  const playOrPause = () => {
    const asyncFunc = async () => {
      if (!videoRef.current) return;
      try {
        if (isRunning) {
          // make sure the video is playing when the playhead is running
          // if the video source is "", trying to play will "unload" the video and we'll show a poster instead
          await videoRef.current.play();
        } else if (!isRunning) {
          // make sure the video is paused when the playhead isn't running
          await videoRef.current.pause();
        }
      } catch (e: unknown) {
        if (isAutoplayError(e)) {
          // the browser is preventing autoplay of unmuted videos. so let's just mute the video. on the next playhead tick, we'll try to play again
          dispatch(
            setPaneStateDataValue({ frameID, paneStateProperty: "muted", paneStateValue: true })
          );
        }
      }
    };
    asyncFunc();
  };

  const getMtxPlaybackRecordForPlayhead = useCallback(
    (queryAppSeconds: number): MTXRecordingTimeRange | null => {
      if (!playheadDate) return null;
      for (const mtxPlaybackRecord of mtxPlaybackRecordsForDownlink) {
        // check that the mtxPlaybackRecord is for today. Remember that these records were modifed
        // when they were fetched to look like they started at midnight if they started before today
        if (!isSameDate(new Date(mtxPlaybackRecord.start), new Date(playheadDate))) continue;

        const mtxDlStartAppSeconds = appSecondsFromDateString(mtxPlaybackRecord.start);
        if (
          queryAppSeconds >= mtxDlStartAppSeconds &&
          queryAppSeconds < mtxDlStartAppSeconds + mtxPlaybackRecord.duration
        ) {
          return mtxPlaybackRecord;
        }
      }
      return null;
    },
    [mtxPlaybackRecordsForDownlink, playheadDate]
  );

  const playVideoAtPlayhead = useCallback(
    (mtxRecordingTimeRange: MTXRecordingTimeRange | null) => {
      if (!mtxRecordingTimeRange || !videoRef.current || !playheadDate) return;
      // add x seconds to counteract the delay in the video starting
      const playheadStart = dateFromAppSeconds(appSeconds + 2, playheadDate)
        .toISOString()
        .replace(/.000Z/, "Z");

      const mtxRecordingsBaseUrl = import.meta.env.VITE_PUBLIC_MEDIA_MTX_RECORDINGS_URL;
      const sourceSuffix = getSourceSuffix(source);
      const channel = (paneStateData.channel + 1).toString();
      setCurrChannel(parseInt(channel));
      const path = `DL${channel}_${sourceSuffix}`;

      const url = new URL("get", mtxRecordingsBaseUrl);
      url.searchParams.append("path", path);
      url.searchParams.append("start", playheadStart);
      url.searchParams.append("duration", mtxRecordingTimeRange.duration.toString());
      setLastURLStartTime(playheadStart);
      videoRef.current.src = url.toString();
      videoRef.current.load();
    },
    [appSeconds, playheadDate, source, paneStateData.channel]
  );

  const selectAndLoadVideo = () => {
    if (!videoRef.current) return;

    // if there is MTX video available, use the MTX playback video pane
    if (currVidMTXPlaybackRecord && currChannel === paneStateData.channel + 1) {
      // there's a video already loaded, so let's make sure it's still the right video
      const currVidStartSeconds = appSecondsFromDateString(currVidMTXPlaybackRecord.start);
      if (
        appSeconds < currVidStartSeconds ||
        appSeconds >= currVidStartSeconds + currVidMTXPlaybackRecord.duration
      ) {
        // the current video is no longer available
        setCurrVidMTXPlaybackRecord(null);
      }
    } else {
      // find the video that is available for the current playhead
      const mtxPlaybackRecord = getMtxPlaybackRecordForPlayhead(appSeconds);
      setCurrVidMTXPlaybackRecord(mtxPlaybackRecord);
      playVideoAtPlayhead(mtxPlaybackRecord);
    }
  };

  const syncToPlayhead = () => {
    // bail if no video element is loaded
    if (!videoRef.current || !currVidMTXPlaybackRecord || !lastURLStartTime) return;

    const { currentTime: currentVidSeconds } = videoRef.current;

    // figure out what the appSeconds is of the current video playhead
    const lastUrlStartTimeAppSeconds = appSecondsFromDateString(lastURLStartTime);
    const videoPlaySeconds = lastUrlStartTimeAppSeconds + currentVidSeconds;

    const mtxPlaybackRecord = getMtxPlaybackRecordForPlayhead(appSeconds);
    if (!isEqual(mtxPlaybackRecord, currVidMTXPlaybackRecord)) {
      setCurrVidMTXPlaybackRecord(mtxPlaybackRecord);
    }

    // playback is off by > x seconds, so we need to assemble a new MTX URL with the correct start time
    if (Math.abs(appSeconds - videoPlaySeconds) < 10) return;

    playVideoAtPlayhead(mtxPlaybackRecord);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- imperative video selection and loading when playback records or playhead changes
  useEffect(selectAndLoadVideo, [
    mtxPlaybackRecordsForDownlink,
    appSeconds,
    paneStateData,
    currChannel,
    currVidMTXPlaybackRecord,
    getMtxPlaybackRecordForPlayhead,
    playVideoAtPlayhead,
  ]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- imperative video sync to playhead position
  useEffect(syncToPlayhead, [
    appSeconds,
    currVidMTXPlaybackRecord,
    mtxPlaybackRecordsForDownlink,
    syncToPlayhead,
    lastURLStartTime,
    getMtxPlaybackRecordForPlayhead,
  ]);
  useEffect(playOrPause, [isRunning, appSeconds, playOrPause]);

  const toggleFullScreen = () => {
    const el = videoRef.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  return (
    <div
      key={`video_element__${frameID}`}
      className={styles.vidContainer}
      data-frame-id={"MTX Player"}
    >
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
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
            dispatch(
              setPaneStateDataValue({ frameID, paneStateProperty: "ready", paneStateValue: true })
            );
          }
        }}
        onEnded={() => {
          // ready up because we don't want a missing video to hold up the playhead
          dispatch(
            setPaneStateDataValue({ frameID, paneStateProperty: "ready", paneStateValue: true })
          );
          setStatus(null);
        }}
        onWaiting={() => {
          if (paneStateData.ready) {
            dispatch(
              setPaneStateDataValue({ frameID, paneStateProperty: "ready", paneStateValue: false })
            );
            setStatus("buffering");
          }
        }}
        onPlaying={() => {
          setStatus("playing");
        }}
        onError={(e) => {
          const vidElement = e.target as HTMLVideoElement;
          if (!vidElement.error?.message.includes("mpty")) {
            //if not 'src attribute is empty' - this eliminates raising an IO error on empty src
            setStatus("error");
            console.error(
              `video ${frameID} has thrown an error ${vidElement.error?.code} - ${vidElement.error?.message}`
            );
          } else {
            setStatus("novid");
          }
          //unblocking playhead
          if (paneStateData.ready !== true) {
            dispatch(
              setPaneStateDataValue({ frameID, paneStateProperty: "ready", paneStateValue: true })
            );
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
          dispatch(
            setPaneStateDataValue({
              frameID,
              paneStateProperty: "showHelp",
              paneStateValue: !paneStateData.showHelp,
            })
          );
        }}
      >
        <VideoMTXHelpContent />
      </HelpOverlay>
    </div>
  );
};

export default VideoMTXPlaybackPane;
