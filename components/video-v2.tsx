import styles from "./video-v2.module.css";
import Button from "components/button";

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
      <div>io and such</div>
    </div>
  );
}

export default function VideoFrame() {
  return <div className={styles.main}>videos are so cool</div>;
}
