import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import PlaybackControls from "components/playback-controls";
import StatusBar from "components/status-bar";
import Video from "components/video";
import Photos from "components/photos";
import WithPlayheadMonitor from "components/with-playhead-monitor";
import styles from "./main.module.css";
import type { QueryParams } from "pages/view/iss";
import { Collection } from "typings";

/**
 * Renders the main CODA application layout for test events. Also handles checking whether the playhead should be running
 */
function Main(props: { query: QueryParams }) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Header />
      </div>
      <div className={styles.body}>
        <div className={styles.bodyRow1}>
          <Video playerID={1} collection={Collection["JSC Rock Yard"]} {...props} />
          <Video playerID={2} collection={Collection["JSC Rock Yard"]} {...props} />
          <Photos />
        </div>
        <div className={styles.bodyRow2}>
          <div style={{ flex: "1 1 auto" }}>{/* <ISSLocation /> */}</div>
          <div style={{ flex: "0 1 170px" }}></div>
        </div>
      </div>
      <div className={styles.footer}>
        <PlaybackControls />
        <NavTimeline />
        <StatusBar />
      </div>
    </div>
  );
}

export default WithPlayheadMonitor(Main);
