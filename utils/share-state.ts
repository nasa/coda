import { hhmmssFromSeconds, shortdateFromDateString } from "utils/formatting";
import { PaneTypeShortVal, SourceShortVal } from "utils/enums";

/**
 * Generates a URL string that represents the state of the application.
 * @returns {string}
 */
export function generateShareURL(framework: FrameworkState, playhead: PlayheadState): string {
  const dt = new Date(playhead.date);

  const missionDate = shortdateFromDateString(dt.toISOString());
  const missionTime = hhmmssFromSeconds(playhead.seconds);

  const layout = framework.layout;
  const shortSource = SourceShortVal[framework.source];

  let i = 1;
  let stateUrlParams = "";
  for (const [_key, element] of Object.entries(framework.frames)) {
    let paneStateString = "";
    switch (element.paneType) {
      case "video_downlink":
        paneStateString = getStateStringForVideo(
          element.paneStateData,
          PaneTypeShortVal.video_downlink
        );
        break;
      case "video_non_downlink":
        paneStateString = getStateStringForVideo(
          element.paneStateData,
          PaneTypeShortVal.video_non_downlink
        );
        break;
      case "photo":
        paneStateString = getStateStringForPhoto(element.paneStateData);
        break;
      case "photo_all":
        paneStateString = getStateStringForPhotoAll(element.paneStateData);
        break;
      case "event_info":
        paneStateString = getStateStringForEventInfo();
        break;
      case "iss_location":
        paneStateString = getStateStringforISSLocation(element.paneStateData);
        break;
      case "gps_location":
        paneStateString = getStateStringforGPSLocation(element.paneStateData);
        break;
      case "comm":
        paneStateString = getStateStringForComm(element.paneStateData);
        break;
    }
    stateUrlParams += "&f" + i + "=" + paneStateString;
    i++;
  }

  const urlRoot = location.origin + location.pathname;
  let URL = `${urlRoot}?date=${missionDate}`;
  URL += `&gmt=${missionTime}`;
  URL += `&v=2.0`; // version number used for tracking the format of share URLs, in case we need to change it in the future
  URL += `&l=${layout}`;
  URL += `&s=${shortSource}`;
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
  const paneTypeString = "0" + PaneTypeShortVal.photo;
  const showInfo = state.showInfo ? "1" : "0";
  const showFilter = state.showFilter ? "1" : "0";
  return `${paneTypeString}${showInfo}${showFilter}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 * Char 2: 0 if showFilter is false, 1 if showFilter is true
 * Char 3: 0 if lockPhotosScroll is false, 1 if lockPhotosScroll is true
 */
function getStateStringForPhotoAll(state: PhotoAllPaneStateData) {
  const paneTypeString = "0" + PaneTypeShortVal.photo_all;
  const showFilter = state.showFilter ? "1" : "0";
  const lockPhotosScroll = state.lockPhotosScroll ? "1" : "0";
  return `${paneTypeString}${showFilter}${lockPhotosScroll}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 */
function getStateStringForEventInfo() {
  const paneTypeString = "0" + PaneTypeShortVal.event_info;
  return `${paneTypeString}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 * Char 2: 0 if lockToggle is false, 1 if lockToggle is true
 */
function getStateStringforISSLocation(state: LocationPaneStateData) {
  const paneTypeString = "0" + PaneTypeShortVal.iss_location;
  const lockToggle = state.lockMap ? "1" : "0";
  return `${paneTypeString}${lockToggle}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 * Char 2: 0 if lockToggle is false, 1 if lockToggle is true
 */
function getStateStringforGPSLocation(state: LocationPaneStateData) {
  const paneTypeString = "0" + PaneTypeShortVal.gps_location;
  const lockToggle = state.lockMap ? "1" : "0";
  return `${paneTypeString}${lockToggle}`;
}

/**
 * @returns {string}
 * Chars 0,1 digits: pane type
 * Char 2: S/G channel number - 1
 */
function getStateStringForComm(state: CommPaneStateData) {
  const paneTypeString = "0" + PaneTypeShortVal.transcript;
  const sgChannel = state.sgChannel.toString();
  return `${paneTypeString}${sgChannel}`;
}

/**
 *
 * @param url All query params sent in the share URL
 * @returns FrameState object populated with the data from the URL
 */
export function interpretFramestateQueryString(query): FrameState {
  const frameState: FrameState = {};
  for (let i = 1; i <= 10; i++) {
    // 10 is the max number of frames
    if (query["f" + i] !== undefined) {
      const paneState = interpretFrameQueryParam(query["f" + i]);
      frameState[i.toString()] = paneState;
    }
  }
  return frameState;
}

/**
 *
 * @param frameString A shortened string representing the state of a frame received as a query parameter
 * @returns
 */
function interpretFrameQueryParam(frameString: string): PaneState {
  if (!frameString) {
    return undefined;
  }

  /* Chars 0,1 digits: pane type */
  const paneType = parseInt(frameString.substring(0, 2));

  switch (paneType) {
    case PaneTypeShortVal.video_downlink:
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
    case PaneTypeShortVal.video_non_downlink:
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
    case PaneTypeShortVal.photo:
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
    case PaneTypeShortVal.photo_all:
      /* Char 2: 0 if showFilter is false, 1 if showInfo is true
       * Char 3: 0 if lockPhotosScroll is false, 1 if lockPhotosScroll is true
       */
      const photoAllReturnVal: { paneType: string; paneStateData: PhotoAllPaneStateData } = {
        paneType: "photo_all",
        paneStateData: {
          ready: true,
          showFilter: frameString.substring(2, 3) === "1",
          lockPhotosScroll: frameString.substring(3, 4) === "1",
          showHelp: false,
        },
      };
      return photoAllReturnVal;
    case PaneTypeShortVal.event_info:
      const eventInfoReturnVal: { paneType: string; paneStateData: EventPaneStateData } = {
        paneType: "event_info",
        paneStateData: {
          ready: true,
          showHelp: false,
        },
      };
      return eventInfoReturnVal;
    case PaneTypeShortVal.iss_location:
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
    case PaneTypeShortVal.gps_location:
      /* Char 2: 0 if lockToggle is false, 1 if lockToggle is true
       */
      const gpsLocationReturnVal: { paneType: string; paneStateData: LocationPaneStateData } = {
        paneType: "gps_location",
        paneStateData: {
          ready: true,
          lockMap: frameString.substring(2, 3) === "1",
          showHelp: false,
        },
      };
      return gpsLocationReturnVal;
    case PaneTypeShortVal.transcript:
      /* Char 2: sgChannel number
       */
      const returnVal: { paneType: string; paneStateData: CommPaneStateData } = {
        paneType: "comm",
        paneStateData: {
          ready: true,
          lockScroll: true,
          filterActive: false,
          sgChannel: parseInt(frameString.substring(2, 3)),
          isMuted: false,
          showHelp: false,
        },
      };
      return returnVal;
    default:
      return undefined;
  }
}
