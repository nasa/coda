import styles from "./index.module.css";
import isNull from "lodash/isNull";
import isNil from "lodash/isNil";

import { JSX, useEffect, useRef, useState } from "react";
import { idFromDate } from "store/sequences";
import { sourceShortVal } from "utils/consts";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { usePlayheadDate } from "store/hooks";
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
import DockviewLayout from "components/framework/dockview/dockview";
import { getPaneInstanceCount } from "components/framework/dockview/dockview-layout-definitions";
import {
  stringToTree,
  treeToSerialized,
} from "components/framework/dockview/dockview-layout-builder";
import { useSearchParams } from "react-router";
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
      serverVersion: {
        version: "",
        gitCommit: "",
      },
    },
    clientVersion: {
      version: __APP_VERSION__,
      gitCommit: __GIT_COMMIT__,
    },
  });

  const dispatch = useAppDispatch();

  const playheadDate = usePlayheadDate();

  // Track whether initial time setup has been done (to distinguish page load from date rollover)
  const hasInitializedTime = useRef(false);

  // urlState.date is already validated by validateShareLinkDateTime and guaranteed to be a valid date string
  const userDate = midnightZulu(new Date(urlState.date));

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
    } else if (!hasInitializedTime.current && !isToday) {
      // Only look for EVA start times on initial load for non-today dates
      // (today with no gmt param should stay at "now", not jump to EVA start)
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
      let evaStartSec: number | null = null;
      const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d))$/; // matches valid hh:mm times
      if (!isNil(sequence) && sequence.startTime && !isNil(sequence.startTime.match(reHHMM))) {
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
      <div className={styles.body}>
        {frameworkReady && <DockviewLayout initialLayout={urlState.dockviewLayout} />}
      </div>
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
  const source = parseInt(query?.get("s") ?? "");
  const layout = query?.get("l");

  // Validate date (no date/future/malformed → today) and clamp future gmt times to now
  const { validatedDate, validatedGmt } = validateShareLinkDateTime(rawDate, rawGmt);
  let date = validatedDate;
  let gmt = validatedGmt;
  let dockviewLayout: import("dockview-react").SerializedDockview | null = null;

  const fState: FrameworkState = { ...initialFrameworkState };
  if (source) {
    if (source === sourceShortVal.ISS) {
      fState.source = "ISS";
      fState.layout = "c";
    } else if (source === sourceShortVal.TEST_EVENTS) {
      fState.source = "TEST_EVENTS";
      // if we're looking at the test events, we need to change the ISS location frame to GPS location pane
      fState.paneInstances = setGPSLocationFrame(fState, "5");
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
      // Default Artemis layout from share link (2026-04-01)
      const defaultArtemisTree = stringToTree(
        "h(v(h(1:625,2:623):469,h(5:794,6:454):364):1251,3:414)"
      );
      if (defaultArtemisTree) dockviewLayout = treeToSerialized(defaultArtemisTree);
      fState.paneInstances = interpretFramestateQueryString(
        new URLSearchParams(
          "f1=01001art002m1010911659&f2=01021art002m1030911743&f3=08&f5=0701&f6=0300"
        )
      );
      if (isNil(rawDate)) {
        date = "2026-04-01";
        if (isNil(rawGmt)) {
          gmt = "18:37:15";
        }
      }
    } else if (source === sourceShortVal.ARTEMIS_TRAINING) {
      fState.source = "ARTEMIS_TRAINING";
      // Default Artemis (Restricted) layout mirrors standard Artemis layout
      const defaultArtemisTree = stringToTree(
        "h(v(h(1:625,2:623):469,h(5:794,6:454):364):1251,3:414)"
      );
      if (defaultArtemisTree) dockviewLayout = treeToSerialized(defaultArtemisTree);
      fState.paneInstances = interpretFramestateQueryString(
        new URLSearchParams(
          "f1=01001art002m1010911659&f2=01021art002m1030911743&f3=08&f5=0701&f6=0300"
        )
      );
      if (isNil(rawDate)) {
        date = "2026-04-01";
        if (isNil(rawGmt)) {
          gmt = "18:37:15";
        }
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
      fState.paneInstances = setNonDLVideoFrame(fState, "1", nonDLvideo1);
    } else if (video1) {
      fState.paneInstances = setDLVideoFrame(fState, "1", video1);
    }
    if (nonDLvideo2) {
      fState.paneInstances = setNonDLVideoFrame(fState, "2", nonDLvideo2);
    } else if (video2) {
      fState.paneInstances = setDLVideoFrame(fState, "2", video2);
    }
  } else if (version === "2.0") {
    fState.paneInstances = interpretFramestateQueryString(query);
  } else if (version === "3.0") {
    // v3: Dockview layout is serialized in the `dv` query param
    const dvParam = query?.get("dv");
    if (dvParam) {
      const tree = stringToTree(decodeURIComponent(dvParam));
      if (tree) dockviewLayout = treeToSerialized(tree);
    }
    // Pane state is still encoded in f1, f2, ... params (same as v2)
    fState.paneInstances = interpretFramestateQueryString(query);
  }

  // Trim frames to match the layout's panel count so that dynamically
  // added panels (via "+") always start empty / show watermark.
  // Skip trimming for v3 links — the Dockview layout defines the panel count.
  if (version !== "3.0") {
    const paneInstanceCount = getPaneInstanceCount(fState.layout);
    if (paneInstanceCount > 0) {
      const trimmed: { [paneInstanceId: string]: PaneState } = {};
      for (const [key, value] of Object.entries(fState.paneInstances)) {
        if (Number(key) <= paneInstanceCount) {
          trimmed[key] = value;
        }
      }
      fState.paneInstances = trimmed;
    }
  }

  const urlState: QueryParams = {
    date: date, // date is now guaranteed to be a string from validateShareLinkDateTime
    gmt: gmt ?? "",
    frameworkState: fState,
    dockviewLayout,
  };

  return urlState;
}

function setNonDLVideoFrame(fState: FrameworkState, frameNum: string, nonDLVideo: string) {
  const frameStateData: PaneState = {
    ...fState.paneInstances[frameNum],
    paneType: "video_non_downlink",
    paneStateData: {
      ...allPanes["video_non_downlink"].defaultPaneStateData,
      channel: -1,
      activeVideoFileID: nonDLVideo,
      muted: true,
    } as VideoPaneStateData,
  };
  return { ...fState.paneInstances, [frameNum]: frameStateData };
}

function setDLVideoFrame(fState: FrameworkState, frameNum: string, downlink: string) {
  const frameStateData: PaneState = {
    ...fState.paneInstances[frameNum],
    paneType: "video_downlink",
    paneStateData: {
      ...allPanes["video_downlink"].defaultPaneStateData,
      channel: parseInt(downlink) - 1,
      muted: true,
    } as VideoPaneStateData,
  };
  return { ...fState.paneInstances, [frameNum]: frameStateData };
}

function setGPSLocationFrame(fState: FrameworkState, frameNum: string) {
  const frameStateData: PaneState = {
    ...fState.paneInstances[frameNum],
    paneType: "gps_location",
    paneStateData: {
      ...allPanes["gps_location"].defaultPaneStateData,
    },
  };
  return { ...fState.paneInstances, [frameNum]: frameStateData };
}
