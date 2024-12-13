import _ from "lodash";
import {
  FunctionComponent,
  MutableRefObject,
  useRef,
  useState,
  MouseEvent,
  ReactNode,
} from "react";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./dropdown-modal.module.css";

const modalDefaults = {
  color: "white",
  size: "default",
  caret: "down",
  modalOptions: {},
};

const oppositeCarets: { [key: string]: string } = {
  down: "up",
  up: "down",
  left: "right",
  right: "left",
};

/** A menu with a down caret that opens a modal below */
export const ModalDropdown: FunctionComponent<{
  children: ReactNode;
  color?: string;
  size?: string;
  modalWidth?: number;
  caret?: string;
  callback?: () => void;
  modal?: FunctionComponent<{
    closeClick?: () => void;
    options?: any;
    display?: boolean;
  }>;
  modalOptions?: any;
}> = ({ children, ...options }) => {
  const opts = { ...modalDefaults, ...options };
  const [display, setDisplay] = useState(false);

  const modalRef = useRef(null) as MutableRefObject<HTMLInputElement>;
  const labelRef = useRef(null) as MutableRefObject<HTMLButtonElement>;

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    setDisplay(!display);
  };

  let caretStyle = styles[opts.caret];
  if (display) {
    caretStyle = styles[oppositeCarets[opts.caret]];
  }

  const colorClass = styles[opts.color];
  const sizeClass = styles[opts.size];
  const modalStyle = {
    display: display ? "block" : "none",
    width: opts.modalWidth ? opts.modalWidth + "px" : null,
  };

  return (
    <div>
      <button className={styles.main} ref={labelRef}>
        <div className={`${styles.label} ${colorClass} ${sizeClass}`} onClick={handleClick}>
          <div className={styles.verticalCenter}>{children}</div>
          <div className={styles.verticalCenter}>
            <div className={`${caretStyle} ${styles.caret}`}>
              &nbsp;
              {opts.caret === "down" && <FontAwesomeIcon icon={faChevronDown} size={"sm"} />}
              {opts.caret === "right" && <FontAwesomeIcon icon={faChevronRight} size={"sm"} />}
            </div>
          </div>
        </div>
      </button>
      <div className={styles.modal} style={modalStyle} ref={modalRef}>
        <opts.modal
          closeClick={() => setDisplay(!display)}
          options={opts.modalOptions}
          display={display}
        />
      </div>
    </div>
  );
};
