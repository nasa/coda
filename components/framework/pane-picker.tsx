import _ from "lodash";
import { useEffect, useState } from "react";
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
import { allPanes, setPaneType } from "store/framework";
import styles from "./pane-picker.module.css";
import { RootState } from "store/index";

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
export function PaneLabel({
  paneType,
}: {
  /** ID of the type of frame */
  paneType: string;
}) {
  const { title, icon, color } = allPanes[paneType];

  return (
    <div className={styles.item}>
      {icon !== "none" ? (
        <div className={`${styles.icon} ${styles[color]}`}>
          <FontAwesomeIcon icon={icon} />
        </div>
      ) : (
        <div className={styles.noneIcon}></div>
      )}
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
  const source = useSelector((state: RootState) => state.framework.source);
  const [availablePanes, setAvailablePanes] = useState([]);

  const dispatch = useDispatch();

  const handleSelectPaneType = (paneType: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    dispatch(setPaneType({ frameID, paneType }));
    closeClick();
  };

  useEffect(() => {
    const availablePanes = Object.keys(allPanes);

    setAvailablePanes(availablePanes);
  }, [source]);

  return (
    <div className={styles.main}>
      {availablePanes.length > 0 ? (
        availablePanes.map((paneType) => (
          <div
            className={styles.option}
            onClick={handleSelectPaneType(paneType)}
            key={`PANE__PICKER__${frameID}__${paneType}`}
          >
            <PaneLabel paneType={paneType} />
          </div>
        ))
      ) : (
        <span>No available sources</span>
      )}
    </div>
  );
}
