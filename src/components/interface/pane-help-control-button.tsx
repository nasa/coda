import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faQuestionCircle } from "@fortawesome/free-solid-svg-icons";
import styles from "./pane-help-control-button.module.css";

library.add(faQuestionCircle);

export function HelpButton(props: { clickHandler; selected?: boolean }) {
  const selectedStyle = props.selected ? styles.selected : "";
  return (
    <div
      className={`${styles.helpButton} ${selectedStyle}`}
      title={`More info`}
      onClick={() => {
        if (props.clickHandler) {
          props.clickHandler();
        }
      }}
    >
      <FontAwesomeIcon icon="question-circle" />
    </div>
  );
}
