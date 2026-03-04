import { FunctionComponent } from "react";

/**
 * General video pane help content.
 * Used when no specific video source is active (poster pane).
 */
export const VideoGeneralHelpContent: FunctionComponent = () => (
  <div>
    <p>Video panes display video content synced to CODA's playback time from multiple sources.</p>
    <p>Video sources include:</p>
    <ul>
      <li>
        <strong>Imagery Online (IO)</strong> - Archived video from NASA's Imagery Online system
      </li>
      <li>
        <strong>Live Streaming (HLS)</strong> - Near-live video from EMSS livestream recorder
      </li>
      <li>
        <strong>Recorded Playback (MTX)</strong> - Recently recorded video from EMSS livestream
        recorder
      </li>
    </ul>
    <p>
      The video pane automatically selects the best available source for the current playback time.
    </p>
    <p>There are two types of Video displays:</p>
    <ol>
      <li>
        <strong>Video Downlink</strong> - Videos categorized by ISS downlink channel. Select a
        channel using the buttons above the video.
      </li>
      <li>
        <strong>Video Non-Downlink</strong> - Uncategorized videos selectable via dropdown menu.
      </li>
    </ol>
  </div>
);

/**
 * Help content for Imagery Online (IO) video player.
 */
export const VideoIOHelpContent: FunctionComponent = () => (
  <div>
    <p>Displays videos from Imagery Online, synced to CODA's playback time.</p>
    <p>
      Videos are all pulled from Imagery Online collections. ISS displays videos in the{" "}
      <a
        href="https://io.jsc.nasa.gov/app/collections.cfm?cid=4"
        target="_blank"
        rel="noopener noreferrer"
      >
        ISS Collection
      </a>
      . Exploration Test Events usually pulls from the root{" "}
      <a
        href="https://io.jsc.nasa.gov/app/collections.cfm?cid=2359928"
        target="_blank"
        rel="noopener noreferrer"
      >
        xEVA Collection
      </a>{" "}
      but this can be overridden by editing the CODA entry for each event in the{" "}
      <a
        href="https://wiki.jsc.nasa.gov/exploration/index.php/Main_Page"
        target="_blank"
        rel="noopener noreferrer"
      >
        Exploration Wiki.
      </a>
    </p>
    <p>There are two types of Video displays:</p>
    <ol>
      <li>
        Video Downlink
        <p>
          Videos from Imagery Online are categorized based on what ISS downlink channel they were
          received on. Select a downlink channel using the downlink channel numbers above the video.
        </p>
        <p>For Test and NBL events, channels have been inferred for common video source types.</p>
      </li>
      <li>
        Video Non-Downlink
        <p>
          Contains the remaining videos from Imagery Online that have not been categorized into
          channels. Videos available at a given CODA time are selected via dropdown.
        </p>
      </li>
    </ol>
    <p>
      Note: If video entries in Imagery Online do not have valid start times, an error will be
      displayed in CODA to indicate that the video is not correctly time synced.
    </p>
  </div>
);

/**
 * Help content for HLS (HTTP Live Streaming) video player.
 */
export const VideoHLSHelpContent: FunctionComponent = () => (
  <div>
    <p>
      <strong>Currently using HLS live stream video playback technique.</strong>
    </p>
    <p>
      Streams live video from an EMSS livestream recorder, synced to CODA's playback time. Video is
      only temporarily available for playback and is deleted as time progresses.
    </p>
    <p>
      HLS (HTTP Live Streaming) provides near-real-time video delivery with adaptive bitrate
      streaming for optimal playback quality.
    </p>
  </div>
);

/**
 * Help content for MTX (MediaMTX) recorded playback video player.
 */
export const VideoMTXHelpContent: FunctionComponent = () => (
  <div>
    <p>
      <strong>Currently using EMSS recorded video playback technique.</strong>
    </p>
    <p>
      Displays videos recorded from an EMSS livestream recorder, synced to CODA's playback time.
      Video is only temporarily available for playback and is deleted as time progresses.
    </p>
    <p>
      MediaMTX recorded playback allows you to view recently captured video segments that have been
      stored on the server.
    </p>
  </div>
);
