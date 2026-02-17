import {
  appSecondsFromDateString,
  hhmmssFromSeconds,
  shortdateFromDateString,
} from "utils/formatting";
import { paneTypeShortVal, sourceShortVal } from "utils/consts";
import { diff, isSameDate, midnightZulu } from "utils/date";
import isNull from "lodash/isNull";
import isNaN from "lodash/isNaN";
import isNil from "lodash/isNil";
import LZUTF8 from "lzutf8";
import type { SerializedDockview } from "dockview-react";
import { getDockviewApi } from "components/framework/dockview/dockview-api-ref";

/**
 * Validates share link date/time parameters.
 * - Dates in the future are changed to today's date
 * - Times in the future (when date is today) are changed to now
 * - No date provided defaults to today
 * @returns Validated date and gmt values, plus a flag indicating if the date was validated to today
 */
export function validateShareLinkDateTime(
  date: string | null,
  gmt: string | null
): { validatedDate: string; validatedGmt: string | null; isToday: boolean } {
  const now = new Date();
  const todayMidnight = midnightZulu(now);
  const todayDateString = now.toISOString().split("T")[0];
  const yyyymmdd = /^\d{4}-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|3[01])$/;
  // Match HH:MM:SS with either literal colons or URL-encoded colons (%3A)
  const reHHMMSS = /^(?:(?:([01]?\d|2[0-3])(?::|%3A)[0-5]\d(?::|%3A)[0-9]\d))$/i;

  let validatedDate: string;
  let validatedGmt = gmt;
  let isToday = false;

  // Validate date
  if (!isNull(date) && !isNull(date.match(yyyymmdd))) {
    const parsedDate = midnightZulu(new Date(date));
    const isFutureDate = diff(parsedDate, todayMidnight) > 0;
    const isMalformedDate = isNaN(parsedDate.valueOf());

    if (isFutureDate || isMalformedDate) {
      // Future or malformed date - set to today
      validatedDate = todayDateString;
      isToday = true;
    } else {
      // Valid date in the past or today - use it
      validatedDate = date;
      isToday = isSameDate(parsedDate, now);
    }
  } else {
    // No date provided or invalid format - default to today
    validatedDate = todayDateString;
    isToday = true;
  }

  // Validate time - only check for future time if the date is today
  if (isToday && !isNil(gmt) && !isNil(gmt.match(reHHMMSS))) {
    // Decode URL-encoded colons before parsing
    const decodedGmt = gmt.replace(/%3A/gi, ":");
    const [hh, mm, ss = 0] = decodedGmt.split(":").map(Number);
    const gmtSeconds = hh * 3600 + mm * 60 + ss;
    const currentSeconds = appSecondsFromDateString(now.toISOString());

    if (gmtSeconds > currentSeconds) {
      // Time is in the future - set to current time
      const currentHH = Math.floor(currentSeconds / 3600);
      const currentMM = Math.floor((currentSeconds % 3600) / 60);
      const currentSS = Math.floor(currentSeconds % 60);
      validatedGmt = `${String(currentHH).padStart(2, "0")}:${String(currentMM).padStart(2, "0")}:${String(currentSS).padStart(2, "0")}`;
    }
  }

  return { validatedDate, validatedGmt, isToday };
}

/**
 * Compresses a SerializedDockview object into a URL-safe Base64 string.
 */
export function compressDockviewSnapshot(layout: SerializedDockview): string {
  const json = JSON.stringify(layout);
  return LZUTF8.compress(json, { outputEncoding: "Base64" });
}

/**
 * Decompresses a URL-safe Base64 string back into a SerializedDockview object.
 * Returns null if decompression or parsing fails.
 */
export function decompressDockviewSnapshot(encoded: string): SerializedDockview | null {
  try {
    const json = LZUTF8.decompress(encoded, { inputEncoding: "Base64" });
    return JSON.parse(json) as SerializedDockview;
  } catch {
    return null;
  }
}

/**
 * Generates a v3 URL string that represents the state of the application,
 * capturing the exact Dockview layout (proportions, splits, panel arrangement).
 *
 * Falls back to v2 format if the DockviewApi is unavailable.
 *
 * @param framework - The framework state
 * @param date - The current date string
 * @param appSeconds - The current app seconds
 * @returns {string}
 */
export function generateShareURL(
  framework: FrameworkState,
  date: string,
  appSeconds: number
): string {
  const dt = new Date(date);

  const missionDate = shortdateFromDateString(dt.toISOString());
  const missionTime = hhmmssFromSeconds(appSeconds);

  const shortSource = sourceShortVal[framework.source];

  let i = 1;
  let stateUrlParams = "";
  for (const [_key, element] of Object.entries(framework.frames)) {
    let paneStateString = "";
    switch (element.paneType) {
      case "video_downlink":
        paneStateString = getStateStringForVideo(
          element.paneStateData as VideoPaneStateData,
          paneTypeShortVal.video_downlink
        );
        break;
      case "video_non_downlink":
        paneStateString = getStateStringForVideo(
          element.paneStateData as VideoPaneStateData,
          paneTypeShortVal.video_non_downlink
        );
        break;
      case "photo":
        paneStateString = getStateStringForPhoto(element.paneStateData as PhotoPaneStateData);
        break;
      case "photo_all":
        paneStateString = getStateStringForPhotoAll(element.paneStateData as PhotoAllPaneStateData);
        break;
      case "event_info":
        paneStateString = getStateStringForEventInfo();
        break;
      case "iss_location":
        paneStateString = getStateStringforISSLocation(
          element.paneStateData as LocationPaneStateData
        );
        break;
      case "gps_location":
        paneStateString = getStateStringforGPSLocation(
          element.paneStateData as GpsTrackPaneStateData
        );
        break;
      case "comm":
        paneStateString = getStateStringForComm(element.paneStateData as CommPaneStateData);
        break;
      case "graph":
        paneStateString = getStateStringForGraph(element.paneStateData as GraphPaneStateData);
        break;
    }
    stateUrlParams += "&f" + i + "=" + paneStateString;
    i++;
  }

  const urlRoot = location.origin + location.pathname;
  let URL = `${urlRoot}?date=${missionDate}`;
  URL += `&gmt=${missionTime}`;
  URL += `&s=${shortSource}`;

  // Capture the live Dockview state snapshot for a v3 share link
  const dockviewApi = getDockviewApi();
  if (dockviewApi) {
    const serialized = dockviewApi.toJSON();
    const compressedLayout = compressDockviewSnapshot(serialized);
    URL += `&v=3.0`;
    URL += `&dv=${encodeURIComponent(compressedLayout)}`;
  } else {
    // Fallback to v2 format when DockviewApi is not available.
    // This can happen if: called before Dockview component initializes,
    // component has unmounted, or in non-browser contexts.
    const layout = framework.layout;
    URL += `&v=2.0`;
    URL += `&l=${layout}`;
  }

  URL += stateUrlParams;

  return URL;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 * Chars 2,3 digits: channel number. -1 if not downlink
 * Char 4: 0 if muted, 1 if unmuted
 * Chars 5+: String of activeVideoFileID (used for non-downlink video selection)
 */
function getStateStringForVideo(state: VideoPaneStateData, paneType: PaneTypeShortVal): string {
  const paneTypeString = "0" + paneType;
  const dlString = state.channel === -1 ? "-1" : "0" + state.channel.toString();
  const mutedString = state.muted ? "1" : "0";
  const activeVideoFileID = state.activeVideoFileID;
  return `${paneTypeString}${dlString}${mutedString}${activeVideoFileID}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 * Char 2: 0 if showInfo is false, 1 if showInfo is true
 * Char 3: 0 if showFilter is false, 1 if showFilter is true
 */
function getStateStringForPhoto(state: PhotoPaneStateData) {
  const paneTypeString = "0" + paneTypeShortVal.photo;
  const showInfo = state.showInfo ? "1" : "0";
  const showFilter = state.showFilter ? "1" : "0";
  return `${paneTypeString}${showInfo}${showFilter}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 * Char 2: 0 if showFilter is false, 1 if showFilter is true
 * Char 3: 0 if lockScroll is false, 1 if lockScroll is true
 */
function getStateStringForPhotoAll(state: PhotoAllPaneStateData) {
  const paneTypeString = "0" + paneTypeShortVal.photo_all;
  const showFilter = state.showFilter ? "1" : "0";
  const lockScroll = state.lockScroll ? "1" : "0";
  return `${paneTypeString}${showFilter}${lockScroll}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 */
function getStateStringForEventInfo() {
  const paneTypeString = "0" + paneTypeShortVal.event_info;
  return `${paneTypeString}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 * Char 2: 0 if lockToggle is false, 1 if lockToggle is true
 */
function getStateStringforISSLocation(state: LocationPaneStateData) {
  const paneTypeString = "0" + paneTypeShortVal.iss_location;
  const lockToggle = state.lockMap ? "1" : "0";
  return `${paneTypeString}${lockToggle}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 * Char 2: 0 if lockToggle is false, 1 if lockToggle is true
 * Chars 3+: Comma delimited list of GPS track names that have been enabled
 */
function getStateStringforGPSLocation(state: GpsTrackPaneStateData) {
  const paneTypeString = "0" + paneTypeShortVal.gps_location;
  const lockToggle = state.lockMap ? "1" : "0";
  const enabledTracks = [];
  for (const [key, value] of Object.entries(state.gpsTrackToggles)) {
    if (value) {
      enabledTracks.push(key);
    }
  }
  const enabledTracksString = enabledTracks.join(",");
  return `${paneTypeString}${lockToggle}${enabledTracksString}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 * No channel info - all channels selected by default
 */
function getStateStringForComm(_state: CommPaneStateData) {
  const paneTypeString = "0" + paneTypeShortVal.talkybot;
  return `${paneTypeString}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 * Char 2: S/G channel number - 1
 */
function getStateStringForGraph(state: GraphPaneStateData) {
  const paneTypeString = paneTypeShortVal.graph;
  const lockToggle = state.lockScroll ? "1" : "0";
  const selectedGraphId = state.selectedGraphId;
  return `${paneTypeString}${lockToggle}${selectedGraphId}`;
}

/**
 *
 * @param url All query params sent in the share URL
 * @returns FrameState object populated with the data from the URL
 */
export function interpretFramestateQueryString(query: URLSearchParams): FrameState {
  const frameState: FrameState = {};
  for (let i = 1; i <= 10; i++) {
    // 10 is the max number of frames
    const frameParam = query?.get("f" + i);
    if (frameParam) {
      const paneState = interpretFrameQueryParam(frameParam);
      if (paneState) {
        frameState[i.toString()] = paneState;
      }
    }
  }
  return frameState;
}

/**
 *
 * @param frameString A shortened string representing the state of a frame received as a query parameter
 * @returns
 */
function interpretFrameQueryParam(frameString: string): PaneState | undefined {
  if (!frameString) {
    return undefined;
  }

  /* Chars 0,1 digits: pane type */
  const paneType = parseInt(frameString.substring(0, 2));

  switch (paneType) {
    case paneTypeShortVal.video_downlink:
      /* Chars 2,3 digits: downlink number. -1 if not downlink
       * Char 4: 0 if muted, 1 if unmuted
       * Chars 5+: String of activeVideoFileID (used for non-downlink video selection)
       */
      const videoDLReturnVal: { paneType: string; paneStateData: VideoPaneStateData } = {
        paneType: "video_downlink",
        paneStateData: {
          ready: true,
          channel: parseInt(frameString.substring(2, 4)),
          muted: frameString.charAt(4) === "1",
          activeVideoFileID: "",
          showInfo: false,
          showHelp: false,
        },
      };
      return videoDLReturnVal;
    case paneTypeShortVal.video_non_downlink:
      const videoNonDLReturnVal: { paneType: string; paneStateData: VideoPaneStateData } = {
        paneType: "video_non_downlink",
        paneStateData: {
          ready: true,
          channel: -1,
          muted: frameString.substring(4, 5) === "1",
          activeVideoFileID: frameString.substring(5, 6),
          showHelp: false,
        } as VideoPaneStateData,
      };
      return videoNonDLReturnVal;
    case paneTypeShortVal.photo:
      /* Char 2: 0 if showInfo is false, 1 if showInfo is true
       * Char 3: 0 if showFilter is false, 1 if showFilter is true
       */
      const photoReturnVal: { paneType: string; paneStateData: PhotoPaneStateData } = {
        paneType: "photo",
        paneStateData: {
          ready: true,
          showInfo: frameString[2] === "1",
          showFilter: frameString.substring(3, 4) === "1",
          showHelp: false,
        },
      };
      return photoReturnVal;
    case paneTypeShortVal.photo_all:
      /* Char 2: 0 if showFilter is false, 1 if showInfo is true
       * Char 3: 0 if lockScroll is false, 1 if lockScroll is true
       */
      const photoAllReturnVal: { paneType: string; paneStateData: PhotoAllPaneStateData } = {
        paneType: "photo_all",
        paneStateData: {
          ready: true,
          showFilter: frameString.substring(2, 3) === "1",
          lockScroll: frameString.substring(3, 4) === "1",
          showHelp: false,
        },
      };
      return photoAllReturnVal;
    case paneTypeShortVal.event_info:
      const eventInfoReturnVal: { paneType: string; paneStateData: EventPaneStateData } = {
        paneType: "event_info",
        paneStateData: {
          ready: true,
          showHelp: false,
        },
      };
      return eventInfoReturnVal;
    case paneTypeShortVal.iss_location:
      /* Char 2: 0 if lockToggle is false, 1 if lockToggle is true
       */
      const issLocationReturnVal: { paneType: string; paneStateData: LocationPaneStateData } = {
        paneType: "iss_location",
        paneStateData: {
          ready: true,
          lockMap: frameString.substring(2, 3) === "1",
          showHelp: false,
        },
      };
      return issLocationReturnVal;
    case paneTypeShortVal.gps_location:
      /* Char 2: 0 if lockScroll is false, 1 if lockToggle is true
       * Char 3+: Comma delimited list of GPS track names that have been enabled
       */
      const enabledTracksString = frameString.substring(3);
      let gpsTrackToggles: GPSTrackToggles = {};
      // if legacy link
      if (!enabledTracksString) {
        gpsTrackToggles = {
          EV1: true,
          EV2: true,
        };
      } else {
        const enabledTracks = frameString.substring(3).split(",");
        for (const name of enabledTracks) {
          gpsTrackToggles[name] = true;
        }
      }
      const gpsLocationReturnVal: { paneType: string; paneStateData: GpsTrackPaneStateData } = {
        paneType: "gps_location",
        paneStateData: {
          ready: true,
          lockMap: frameString.substring(2, 3) === "1",
          showHelp: false,
          gpsTrackToggles,
        },
      };
      return gpsLocationReturnVal;
    case paneTypeShortVal.talkybot:
      /* Channel info ignored - all channels selected by default
       */
      const commReturnVal: { paneType: string; paneStateData: CommPaneStateData } = {
        paneType: "comm",
        paneStateData: {
          ready: true,
          lockScroll: true,
          filterActive: false,
          sgChannels: [],
          isMuted: false,
          showHelp: true,
        },
      };
      return commReturnVal;
    case paneTypeShortVal.graph:
      /** Char 2: 0 if lockScroll is false, 1 if lockToggle is true
       * Char 3+4 graph id:
       */

      const graphReturnVal: { paneType: string; paneStateData: GraphPaneStateData } = {
        paneType: "graph",
        paneStateData: {
          ready: true,
          lockScroll: frameString.substring(2, 3) === "1",
          showHelp: false,
          selectedGraphId: frameString.substring(3),
        },
      };
      return graphReturnVal;
    default:
      return undefined;
  }
}
