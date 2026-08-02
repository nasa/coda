import { FunctionComponent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQuestionCircle } from "@fortawesome/free-solid-svg-icons";
import styles from "./pane-help-control-button.module.css";

export const HelpButton: FunctionComponent<{ clickHandler: () => void; selected?: boolean }> = ({
  clickHandler,
  selected,
}) => {
  const selectedStyle = selected ? styles.selected : "";
  return (
    <div
      className={`${styles.helpButton} ${selectedStyle}`}
      title={`More info`}
      role="button"
      aria-label="Toggle help overlay"
      onClick={() => {
        if (clickHandler) {
          clickHandler();
        }
      }}
    >
      <FontAwesomeIcon icon={faQuestionCircle} />
    </div>
  );
};
