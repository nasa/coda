import _ from "lodash";
import React, { MutableRefObject, useEffect, useRef, useState } from "react";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./dropdown-modal.module.css";

library.add(faChevronDown, faChevronRight);

export interface Options {
  color?: string;
  /** `default` or `skinny` */
  size?: string;
  /** `up`, `down`, `left`, or `right` */
  modalWidth?: number;
  caret?: string;
  callback?: () => void;
  modal?: ({ closeClick, options }: { closeClick?: () => void; options: any }) => JSX.Element;
  modalOptions?: any;
}

const modalDefaults: Options = {
  color: "white",
  size: "default",
  caret: "down",
  modalOptions: {},
};

const oppositeCarets = {
  down: "up",
  up: "down",
  left: "right",
  right: "left",
};

/** A menu with a down caret that opens a modal below */
export function ModalDropdown(options: React.PropsWithChildren<Options>) {
  // TODO: Really should be a ModalDropdown
  const opts = { ...modalDefaults, ...options };
  const [display, setDisplay] = useState(false);

  const modalRef = useRef(null) as MutableRefObject<HTMLInputElement>;
  const labelRef = useRef(null) as MutableRefObject<HTMLInputElement>;

  // TODO: it would be nice to grab the width when it first renders and use that to fix the width
  //       when the modal is expanded. right now you have to fix the width in the containing element

  const toggleDisplay = (e) => {
    let t = e.target;
    if (!_.isNil(t) && (!modalRef.current.contains(t) || labelRef.current.contains(t))) {
      setDisplay(!display);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setDisplay(!display);
  };

  useEffect(() => {
    if (display) {
      window.addEventListener("click", toggleDisplay);
    }
    return () => {
      window.removeEventListener("click", toggleDisplay);
    };
  }, [display]);

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
          <div className={styles.verticalCenter}>{opts.children}</div>
          <div className={styles.verticalCenter}>
            <div className={`${caretStyle} ${styles.caret}`}>
              &nbsp;
              {opts.caret === "down" && <FontAwesomeIcon icon="chevron-down" size={"sm"} />}
              {opts.caret === "right" && <FontAwesomeIcon icon="chevron-right" size={"sm"} />}
            </div>
          </div>
        </div>
      </button>
      <div className={styles.modal} style={modalStyle} ref={modalRef}>
        <opts.modal closeClick={() => setDisplay(!display)} options={opts.modalOptions} />
      </div>
    </div>
  );
}
