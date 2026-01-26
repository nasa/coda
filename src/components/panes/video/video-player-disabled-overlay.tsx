import { FunctionComponent } from "react";
import styles from "./video-player-disabled-overlay.module.css";

const ADMIN_TEAMS_LINK =
  "https://teams.microsoft.com/l/chat/0/0?users=dcharney@ndc.nasa.gov,ejmontal@ndc.nasa.gov,ptvu1@ndc.nasa.gov,bfeist@ndc.nasa.gov";

export const VideoPlayerDisabledOverlay: FunctionComponent = () => {
  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <h3 className={styles.title}>This Video is Disabled</h3>
        <p className={styles.message}>
          Video has been disabled for this browser by the CODA administrators. This can happen when
          the CODA video service is overloaded. Videos from Imagery Online are still available.
          Please contact the EMSS team via{" "}
          <a
            href={ADMIN_TEAMS_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.contactLink}
          >
            MS Teams
          </a>{" "}
          for any questions or comments.
        </p>
      </div>
    </div>
  );
};
