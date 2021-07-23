import { library } from "@fortawesome/fontawesome-svg-core";
import { faExpandAlt, faInfo, faVolumeUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "components/button";
import styles from "./video-v2.module.css";

library.add(faExpandAlt, faInfo, faVolumeUp);

export function IOInfoButton() {
  return (
    <button className={styles.ioButton}>
      <span className={styles.ioLabel}>
        IO{" "}
        <span style={{ fontSize: "8px", position: "relative", top: "-1px" }}>
          <FontAwesomeIcon icon="info" />
        </span>
      </span>
    </button>
  );
}

export function MuteButton() {
  return (
    <button className={styles.clearTextButton}>
      <FontAwesomeIcon icon="volume-up" />
    </button>
  );
}

export function ExpandButton() {
  return (
    <button className={styles.clearTextButton}>
      <FontAwesomeIcon icon="expand-alt" />
    </button>
  );
}

export function VideoControls() {
  const downlinks = [1, 2, 3, 4, 5, 6];
  return (
    <div className={styles.controls}>
      <div className={styles.selections}>
        {downlinks.map((d) => {
          let rounded = "none";
          if (d === 1) {
            rounded = "left";
          } else if (d === 6) {
            rounded = "right";
          }

          return (
            <div className={styles.dlButton}>
              <Button color="lightest-grey" size="small" rounded={rounded}>
                <div className={styles.dlLabel}>{d}</div>
              </Button>
            </div>
          );
        })}
      </div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <IOInfoButton />
        </div>
        <div className={styles.verticalCenter}>
          <MuteButton />
        </div>
        <div className={styles.verticalCenter}>
          <ExpandButton />
        </div>
      </div>
    </div>
  );
}

export default function VideoFrame() {
  return <div className={styles.main}>videos are so cool</div>;
}
