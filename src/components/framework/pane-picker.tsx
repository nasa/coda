import { useEffect, useState, FunctionComponent } from "react";
import { refEqual, useAppSelector } from "utils/useAppSelector";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { allPanes, setPaneType } from "store/framework";
import styles from "./pane-picker.module.css";
import { RootState } from "store/index";
import { useAppDispatch } from "utils/useAppDispatch";

/**
 * Renders the label for a type of frame
 */
export const PaneLabel: FunctionComponent<{
  paneType: string;
  labelSize?: "S" | "M" | "L";
}> = ({ paneType, labelSize }) => {
  const { title, shortTitle, icon, color } = allPanes[paneType];

  let displayTitle = title;
  if (labelSize === "M") {
    displayTitle = shortTitle;
  } else if (labelSize === "S") {
    displayTitle = "";
  }

  return (
    <div className={styles.item}>
      {icon !== null ? (
        <div className={`${styles.icon} ${styles[color]}`}>
          <FontAwesomeIcon icon={icon} />
        </div>
      ) : (
        <div className={styles.noneIcon}></div>
      )}
      <div className={styles.verticalCenter}>{displayTitle}</div>
    </div>
  );
};

/** Renders a modal with a list of frame types to choose from */
export const PanePickerModal: FunctionComponent<{
  closeClick: () => void;
  options: { frameID: number };
}> = ({ closeClick, options: { frameID } }) => {
  const source = useAppSelector((state: RootState) => state.framework.source, refEqual);
  const [availablePanes, setAvailablePanes] = useState([]);

  const dispatch = useAppDispatch();

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
};

export default PanePickerModal;
