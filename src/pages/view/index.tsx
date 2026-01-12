import styles from "./index.module.css";
import isNull from "lodash/isNull";
import isNil from "lodash/isNil";

import { JSX, useEffect, useRef, useState } from "react";
import { idFromDate } from "store/sequences";
import { sourceShortVal } from "utils/consts";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import {
  allPanes,
  initialState as initialFrameworkState,
  setAllFrameworkState,
} from "store/framework";
import { setDate, setAppSeconds } from "store/clock";
import { interpretFramestateQueryString, validateShareLinkDateTime } from "utils/share-state";
import PlaybackControls from "components/interface/playback-controls";
import Header from "components/interface/header";
import Timeline from "components/interface/nav-timeline";
import Viewer from "components/framework/frames";
import { useSearchParams } from "react-router";
import { URLSearchParams } from "url";
import { isSameDate, midnightZulu } from "../../utils/date";
import SocketClient from "components/framework/SocketClient";
import { appSecondsFromDateString } from "utils/formatting";

export function V2(): JSX.Element {
  const [searchParams, _setSearchParams] = useSearchParams();
  const urlState: QueryParams = getURLParams(searchParams);

  const source = useAppSelector((state) => state.framework.source, refEqual);
  const sequences = useAppSelector((state) => state.sequences, deepEqual);
  const allEVAs = sequences.allSequences;

  const [helpLoaderOpen, setHelpLoaderOpen] = useState(true);
  const [frameworkReady, setFrameworkReady] = useState(false);
  const [socketStatus, setSocketStatus] = useState<ClientSocketStatus>({
    connectionStatus: "disconnected",
    lastStatusFromServer: {
      timestamp: 0,
      visitorCount: 0,
      serverVersion: null,
    },
    clientVersion: {
      version: __APP_VERSION__,
      gitCommit: __GIT_COMMIT__,
    },
  });

  const dispatch = useAppDispatch();

  const playheadDate = useAppSelector((state) => state.clock.date, refEqual);

  // Track whether initial time setup has been done (to distinguish page load from date rollover)
  const hasInitializedTime = useRef(false);

  // make sure the application is running on the correct date
  // urlState.date is already validated by validateShareLinkDateTime
  const userDate = !isNull(urlState.date)
    ? midnightZulu(new Date(urlState.date))
    : midnightZulu(new Date());

  useEffect(() => {
    if (!playheadDate || !isSameDate(new Date(playheadDate), userDate)) {
      dispatch(setDate(userDate.toISOString()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect for initial date setup
  }, []);

  useEffect(() => {
    // make sure the application is running on the correct time
    // Only apply "jump to live" logic on initial page load, not on date rollover/calendar changes
    // Use userDate (from URL or default today) since playheadDate might be null initially
    const isToday = isSameDate(new Date(), userDate);

    // Default time: if today and this is initial load, use current time; otherwise 10:30:00Z
    let userTime =
      isToday && !hasInitializedTime.current
        ? appSecondsFromDateString(new Date().toISOString())
        : 10.5 * 60 * 60;

    const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d:[0-9]\d))$/; // matches valid hh:mm:ss times
    // change the time if the user set the `gmt` query param and it's in a valid format
    if (!isNil(urlState.gmt) && !isNil(urlState.gmt.match(reHHMM))) {
      const [hh, mm, ss = 0] = urlState.gmt.split(":").map(Number);
      userTime = hh * 3600 + mm * 60 + ss;
    } else if (!hasInitializedTime.current) {
      // Only look for EVA start times on initial load
      // change the time if the sequence has a PET start time
      let filteredEVAs = allEVAs;
      if (urlState.frameworkState.source === "NBL") {
        // Show only NBL sequences
        filteredEVAs = filteredEVAs.filter((eva) => eva.displayTitle.includes("NBL"));
      } else if (urlState.frameworkState.source === "TEST_EVENTS") {
        // Filter out all NBL sequences
        filteredEVAs = filteredEVAs.filter((eva) => !eva.displayTitle.includes("NBL"));
      }
      const sequence = filteredEVAs.find((eva) => eva.startDate === idFromDate(playheadDate));
      let evaStartSec = null as number;
      const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d))$/; // matches valid hh:mm times
      if (!isNil(sequence) && !isNil(sequence.startTime.match(reHHMM))) {
        const [hh, mm] = sequence.startTime.split(":");
        evaStartSec = 3600 * +hh + 60 * +mm;
        userTime = evaStartSec;
      }
    }

    // Only set time on initial load, not when sequences update after rollover
    if (!hasInitializedTime.current) {
      dispatch(setAppSeconds(userTime));
      hasInitializedTime.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when sequences change for EVA start time lookup
  }, [sequences]);

  useEffect(() => {
    // set the framework state if that object was set in url query params
    if (!isNull(urlState.frameworkState)) {
      dispatch(setAllFrameworkState(urlState.frameworkState));
    }
    // Mark framework as ready after URL state has been applied
    setFrameworkReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect for framework initialization
  }, []);

  return (
    <div className={styles.main}>
      <title>{`CODA - ${source}`}</title>
      <Header
        helpLoaderOpen={helpLoaderOpen}
        setHelpLoaderOpen={setHelpLoaderOpen}
        socketStatus={socketStatus}
      />
      <SocketClient socketStatus={socketStatus} setSocketStatus={setSocketStatus} />
      <div className={styles.body}>{frameworkReady && <Viewer />}</div>
      <Timeline source={source} />
      <PlaybackControls />
    </div>
  );
}

export default V2;

function getURLParams(query: URLSearchParams): QueryParams {
  const version = query?.get("v") || "1.0"; //version of share URL being received
  const rawDate = query?.get("date");
  const rawGmt = query?.get("gmt");
  const source = parseInt(query?.get("s"));
  const layout = query?.get("l");

  // Validate share link date/time - future dates go to today, future times go to now
  const { validatedDate, validatedGmt } = validateShareLinkDateTime(rawDate, rawGmt);
  let date = validatedDate;
  let gmt = validatedGmt;

  const fState: FrameworkState = { ...initialFrameworkState };
  if (source) {
    if (source === sourceShortVal.ISS) {
      fState.source = "ISS";
      fState.layout = "c";
    } else if (source === sourceShortVal.TEST_EVENTS) {
      fState.source = "TEST_EVENTS";
      // if we're looking at the test events, we need to change the ISS location frame to GPS location pane
      fState.frames = setGPSLocationFrame(fState, "5");
      // set the default layout to the standard without Event Info
      fState.layout = "c";
      // if (isNil(date)) {
      //   // 2021-10-23 is a good representation of Test Events (D-RATS 2021)
      //   date = new Date(2021, 9, 23).toISOString().split("T")[0]; // 9 = October
      // }
    } else if (source === sourceShortVal.NBL) {
      fState.source = "NBL";
      // set the default layout to show no map, only All Photos along the bottom
      fState.layout = "e";
      if (isNil(date)) {
        // 2021-10-28 is a good representation of NBL events
        date = new Date(2021, 9, 28).toISOString().split("T")[0]; // 9 = October
      }
    } else if (source === sourceShortVal.ARTEMIS) {
      fState.source = "ARTEMIS";
      // set the default layout to show no map, only All Photos along the bottom
      fState.layout = "e";
      if (isNil(date)) {
        // 2022-12-05 is a good representation of Artemis 1 events
        date = new Date(2022, 11, 5).toISOString().split("T")[0]; // 9 = October
      }
      if (isNil(gmt)) {
        // 2022-12-05 at 17:14:44 is a good representation of Artemis 1 events
        gmt = "17:14:44";
      }
    }
  }

  // Override default layouts with the one requested if it exists
  if (layout) {
    fState.layout = layout;
  }

  // if pane state data was passed in the query string, use it
  // Legacy support for old URLs
  if (version === "1.0") {
    const video1 = query?.get("video1");
    const video2 = query?.get("video2");
    const nonDLvideo1 = query?.get("nonDLvideo1");
    const nonDLvideo2 = query?.get("nonDLvideo2");

    if (nonDLvideo1) {
      fState.frames = setNonDLVideoFrame(fState, "1", nonDLvideo1);
    } else if (video1) {
      fState.frames = setDLVideoFrame(fState, "1", video1);
    }
    if (nonDLvideo2) {
      fState.frames = setNonDLVideoFrame(fState, "2", nonDLvideo2);
    } else if (video2) {
      fState.frames = setDLVideoFrame(fState, "2", video2);
    }
  } else if (version === "2.0") {
    fState.frames = interpretFramestateQueryString(query);
  }
  const urlState: QueryParams = {
    date,
    gmt,
    frameworkState: fState,
  };

  return urlState;
}

function setNonDLVideoFrame(fState: FrameworkState, frameNum: string, nonDLVideo: string) {
  const frameStateData = {
    ...fState.frames[frameNum],
    paneType: "video_non_downlink",
    paneStateData: {
      ...allPanes["video_non_downlink"].defaultPaneStateData,
      channel: -1,
      activeVideoFileID: nonDLVideo,
      muted: true,
    } as VideoPaneStateData,
  };
  return { ...fState.frames, [frameNum]: frameStateData };
}

function setDLVideoFrame(fState: FrameworkState, frameNum: string, downlink: string) {
  const frameStateData = {
    ...fState.frames[frameNum],
    paneType: "video_downlink",
    paneStateData: {
      ...allPanes["video_downlink"].defaultPaneStateData,
      channel: parseInt(downlink) - 1,
      muted: true,
    } as VideoPaneStateData,
  };
  return { ...fState.frames, [frameNum]: frameStateData };
}

function setGPSLocationFrame(fState: FrameworkState, frameNum: string) {
  const frameStateData = {
    ...fState.frames[frameNum],
    paneType: "gps_location",
    paneStateData: {
      ...allPanes["gps_location"].defaultPaneStateData,
    },
  };
  return { ...fState.frames, [frameNum]: frameStateData };
}
