import styles from "./pane-help-overlay.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { FunctionComponent } from "react";

const HelpOverlay: FunctionComponent<{
  children: JSX.Element;
  isModalOpen: boolean;
  closeHandler: Function;
}> = ({ children, isModalOpen, closeHandler }) => {
  const visibleClass = isModalOpen ? styles.helpModalWrapperVisible : "";
  return (
    <div className={`${styles.helpModalWrapper} ${visibleClass}`}>
      <div className={styles.closeButton} onClick={() => closeHandler()}>
        <FontAwesomeIcon icon={faTimesCircle} size="lg" />
      </div>
      <div className={styles.helpBody}>{children}</div>
    </div>
  );
};

export default HelpOverlay;
