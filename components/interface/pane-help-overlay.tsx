import styles from "./pane-help-overlay.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons";

library.add(faTimesCircle);

export default function HelpOverlay(props: {
  children;
  isModalOpen: boolean;
  closeHandler: Function;
}) {
  const visibleClass = props.isModalOpen ? styles.helpModalWrapperVisible : "";
  return (
    <div className={`${styles.helpModalWrapper} ${visibleClass}`}>
      <div className={styles.closeButton} onClick={() => props.closeHandler()}>
        <FontAwesomeIcon icon="times-circle" size="lg" />
      </div>
      <div className={styles.helpBody}>{props.children}</div>
    </div>
  );
}
