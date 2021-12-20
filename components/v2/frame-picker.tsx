import _ from "lodash";
import React from "react";
import { useDispatch } from "react-redux";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faCamera,
  faGlobeAmericas,
  faChartLine,
  faShareSquare,
  faInfo,
  faLayerGroup,
  faSquare,
  faVideo,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { allFrames, selectFrameType } from "store/viewer";
import styles from "./frame-picker.module.css";

library.add(
  faCamera,
  faChartLine,
  faGlobeAmericas,
  faInfo,
  faLayerGroup,
  faShareSquare,
  faSquare,
  faVideo
);

/**
 * Renders the label for a type of frame
 */
export function FrameLabel({
  frameType,
}: {
  /** ID of the type of frame */
  frameType: string;
}) {
  const { title, icon, color } = allFrames[frameType];

  return (
    <div className={styles.item}>
      <div className={`${styles.icon} ${styles[color]}`}>
        <FontAwesomeIcon icon={icon} />
      </div>
      <div className={styles.verticalCenter}>{title}</div>
    </div>
  );
}

/** Renders a modal with a list of frame types to choose from */
export default function FramePickerModal({
  closeClick,
  options: { frameID },
}: {
  closeClick: () => void;
  options: { frameID: number };
}) {
  const dispatch = useDispatch();

  const handleSelectFrameType = (frameType: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    dispatch(selectFrameType({ frameID, frameType }));
    closeClick();
  };

  const availableFrames = Object.keys(allFrames).filter((frameType) =>
    frameType.startsWith("iss_")
  );

  return (
    <div className={styles.main}>
      {availableFrames.length > 0 ? (
        availableFrames.map((frameType) => (
          <div
            className={styles.option}
            onClick={handleSelectFrameType(frameType)}
            key={`FRAME__PICKER__${frameID}__${frameType}`}
          >
            <FrameLabel frameType={frameType} />
          </div>
        ))
      ) : (
        <span>No available sources</span>
      )}
    </div>
  );
}
