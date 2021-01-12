import Audio from "./audio";
import Videos from "./videos";
import styles from "./av-panels.module.css";

/**
 * Renders the part of the CODA interface that includes audio and video players and selectors
 */
function AVPanels() {
  return (
    <div className={styles.container}>
      <Audio />
      <Videos />
    </div>
  );
}

export default AVPanels;
