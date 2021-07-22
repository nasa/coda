import { library } from "@fortawesome/fontawesome-svg-core";
import { faCamera, faGlobeAmericas, faVideo } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./frame-picker.module.css";

library.add(faCamera, faGlobeAmericas, faVideo);

export function FrameSelection() {
  return (
    <div className={styles.item}>
      <div className={`${styles.icon} ${styles.teal}`}>
        <FontAwesomeIcon icon="video" />
      </div>
      <div className={styles.verticalCenter}>ISS Video Downlink</div>
    </div>
  );
}

export default function FramePicker() {
  return (
    <div className={styles.main}>
      <div className={styles.item}>
        <div className={`${styles.icon} ${styles.teal}`}>
          <FontAwesomeIcon icon="video" />
        </div>
        <div className={styles.verticalCenter}>ISS Video Downlink</div>
      </div>
      <div className={styles.item}>
        <div className={`${styles.icon} ${styles.teal}`}>
          <FontAwesomeIcon icon="video" />
        </div>
        <div className={styles.verticalCenter}>ISS Video Non-Downlink</div>
      </div>
      <div className={styles.item}>
        <div className={`${styles.icon} ${styles.ruby}`}>
          <FontAwesomeIcon icon="camera" />
        </div>
        <div className={styles.verticalCenter}>ISS Photography</div>
      </div>
      <div className={styles.item}>
        <div className={`${styles.icon} ${styles.purple}`}>
          <FontAwesomeIcon icon="globe-americas" />
        </div>
        <div className={styles.verticalCenter}>ISS Groundtrack</div>
      </div>
      <div className={styles.item}>
        <div className={`${styles.icon} ${styles.mustardGreen}`}>
          <FontAwesomeIcon icon="video" />
        </div>
        <div className={styles.verticalCenter}>EVA Info</div>
      </div>
      <div className={styles.item}>
        <div className={`${styles.icon} ${styles.mustardGreen}`}>
          <FontAwesomeIcon icon="video" />
        </div>
        <div className={styles.verticalCenter}>DOUG</div>
      </div>
      <div className={styles.item}>
        <div className={`${styles.icon} ${styles.mustardGreen}`}>
          <FontAwesomeIcon icon="video" />
        </div>
        <div className={styles.verticalCenter}>ISS Telemetry</div>
      </div>
    </div>
  );
}
