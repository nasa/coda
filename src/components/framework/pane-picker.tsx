import { useMemo, FunctionComponent } from "react";
import { refEqual, useAppSelector } from "utils/useAppSelector";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { allPanes, setPaneType } from "store/framework";
import styles from "./pane-picker.module.css";
import { useAppDispatch } from "utils/useAppDispatch";
import { getAvailablePanesForSource } from "utils/sourceDataTypeMap";

interface PanePickerModalOptions {
  paneInstanceId: number;
}

/**
 * Renders the label for a type of pane
 */
export const PaneLabel: FunctionComponent<{
  paneType: PaneType;
  labelSize?: "S" | "M" | "L";
}> = ({ paneType, labelSize }) => {
  const { title, shortTitle, icon } = allPanes[paneType];

  let displayTitle = title;
  if (labelSize === "M") {
    displayTitle = shortTitle;
  } else if (labelSize === "S") {
    displayTitle = "";
  }

  return (
    <div className={styles.item}>
      {icon ? (
        <div className={styles.icon}>
          <FontAwesomeIcon icon={icon} />
        </div>
      ) : (
        <div className={styles.noneIcon}></div>
      )}
      <div className={styles.verticalCenter}>{displayTitle}</div>
    </div>
  );
};

/** Renders a modal with a list of panes to choose from */
export const PanePickerModal: FunctionComponent<{
  closeClick?: () => void;
  options?: PanePickerModalOptions;
  onClosePanel?: () => void;
}> = ({ closeClick, options, onClosePanel }) => {
  const paneInstanceId = options?.paneInstanceId ?? 0;
  const source = useAppSelector((state) => state.framework.source, refEqual);
  const date = useAppSelector((state) => state.clock.date, refEqual);
  const pcdAudioDateGate = useAppSelector((state) => state.pcdAudio.dateGate, refEqual);

  const dispatch = useAppDispatch();

  const paneDateRanges = useMemo(() => ({ pcd_audio: pcdAudioDateGate }), [pcdAudioDateGate]);

  const allPaneTypes = Object.keys(allPanes) as PaneType[];
  const availablePanes = useMemo(
    () =>
      getAvailablePanesForSource(source, allPaneTypes, date, paneDateRanges).filter(
        (pt) => pt !== "empty"
      ),
    [source, allPaneTypes, date, paneDateRanges]
  );

  const handleSelectPaneType = (paneType: PaneType) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(setPaneType({ paneInstanceId, paneType }));
    closeClick?.();
  };

  const handleClosePanel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeClick?.();
    onClosePanel?.();
  };

  return (
    <div className={styles.main}>
      {availablePanes.length > 0 ? (
        availablePanes.map((paneType) => (
          <div
            className={styles.option}
            onClick={handleSelectPaneType(paneType)}
            key={`PANE__PICKER__${paneInstanceId}__${paneType}`}
          >
            <PaneLabel paneType={paneType} />
          </div>
        ))
      ) : (
        <span>No available sources</span>
      )}
      {onClosePanel && (
        <div className={`${styles.option} ${styles.closeOption}`} onClick={handleClosePanel}>
          <span className={styles.closeLabel}>Remove Panel</span>
        </div>
      )}
    </div>
  );
};

export default PanePickerModal;
