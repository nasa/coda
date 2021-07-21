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
  modal?: ({ closeClick }: { closeClick: () => void }) => JSX.Element;
  caret?: string;
}

const pseudoDefaults: PseudoOptions = {
  color: "white",
  caret: "down",
};

/** A menu with a down caret that opens a modal below */
export function PseudoDropdown(options: React.PropsWithChildren<PseudoOptions>) {
  const opts = { ...pseudoDefaults, ...options };
  const [display, setDisplay] = useState(false);

  return (
    <div className={styles.main}>
      <div className={`${styles.label} ${styles[opts.color]}`} onClick={() => setDisplay(!display)}>
        <div className={styles.verticalCenter}>{opts.children}</div>
        <div className={styles.verticalCenter}>
          <div className={`${styles[opts.caret]} ${styles.caret}`}>
            &nbsp;
            <FontAwesomeIcon icon="chevron-down" />
          </div>
        </div>
      </div>
      <div className={styles.modal} style={{ display: display ? "block" : "none" }}>
        <opts.modal closeClick={() => setDisplay(!display)} />
      </div>
    </div>
  );
}
