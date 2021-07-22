import React, { useState } from "react";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./dropdown-v2.module.css";

library.add(faChevronDown);

export interface Options {
  color?: string;
  callback?: () => void;
}

const defaults: Options = {
  color: "white",
  callback: () => {},
};

/** A menu that shows options to choose from */
export default function Dropdown(options: React.PropsWithChildren<Options>) {
  const opts = { ...defaults, ...options };

  return <>{opts.children}</>;
}

export interface PseudoOptions {
  color?: string;
  /** `default` or `skinny` */
  size?: string;
  modal?: ({ closeClick }: { closeClick: () => void }) => JSX.Element;
  caret?: string;
}

const pseudoDefaults: PseudoOptions = {
  color: "white",
  size: "default",
  caret: "down",
};

const oppositeCarets = {
  down: "up",
  up: "down",
  left: "right",
  right: "left",
};

/** A menu with a down caret that opens a modal below */
export function PseudoDropdown(options: React.PropsWithChildren<PseudoOptions>) {
  const opts = { ...pseudoDefaults, ...options };
  const [display, setDisplay] = useState(false);

  // TODO: it would be nice to grab the width when it first renders and use that to fix the width
  //       when the modal is expanded. right now you have to fix the width in the containing element

  const toggleDropdown = (e: React.MouseEvent) => {
    e.preventDefault();

    setDisplay(!display);
  };

  let caretStyle = styles[opts.caret];
  if (display) {
    caretStyle = styles[oppositeCarets[opts.caret]];
  }

  const colorClass = styles[opts.color];
  const sizeClass = styles[opts.size];

  return (
    <div>
      <div className={styles.main}>
        <div className={`${styles.label} ${colorClass} ${sizeClass}`} onClick={toggleDropdown}>
          <div className={styles.verticalCenter}>{opts.children}</div>
          <div className={styles.verticalCenter}>
            <div className={`${caretStyle} ${styles.caret}`}>
              &nbsp;
              <FontAwesomeIcon icon="chevron-down" />
            </div>
          </div>
        </div>
        <div
          className={styles.background}
          style={{ display: display ? "block" : "none" }}
          onClick={toggleDropdown}
        />
      </div>
      <div className={styles.modal} style={{ display: display ? "block" : "none" }}>
        <opts.modal closeClick={() => setDisplay(!display)} />
      </div>
    </div>
  );
}
