import _ from "lodash";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
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
import { RootState } from "../../store/";

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
  frameTypeID,
}: {
  /** ID of the type of frame */
  frameTypeID: number;
}) {
  const { title, icon, color } = allFrames[frameTypeID];

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
export default function PanePickerModal({
  closeClick,
  options: { frameID },
}: {
  closeClick: () => void;
  options: { frameID: number };
}) {
  const dispatch = useDispatch();
  const selectedSource = useSelector((state: RootState) => state.viewer.selectedSource);

  const handleSelectFrameType = (frameTypeID: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    dispatch(selectFrameType({ frameID, frameTypeID }));
    closeClick();
  };

  const availableFrames = Object.keys(allFrames).filter(
    (frameTypeID) => allFrames[frameTypeID].source === selectedSource
  );

  return (
    <div className={styles.main}>
      {availableFrames.length > 0 ? (
        availableFrames.map((frameTypeID) => (
          <div
            className={styles.option}
            onClick={handleSelectFrameType(+frameTypeID)}
            key={`FRAME__PICKER__${frameID}__${frameTypeID}`}
          >
            <FrameLabel frameTypeID={+frameTypeID} />
          </div>
        ))
      ) : (
        <span>No available sources</span>
      )}
    </div>
  );
}
