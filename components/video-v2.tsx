import styles from "./video-v2.module.css";
import Button from "components/button";

export function VideoControls() {
  const downlinks = [1, 2, 3, 4, 5, 6];
  return (
    <div className={styles.controls}>
      {downlinks.map((d) => {
        return (
          <div className={styles.dlButton}>
            <Button color="lightest-grey" size="small">
              {d}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export default function VideoFrame() {
  return <div className={styles.main}>videos are so cool</div>;
}
