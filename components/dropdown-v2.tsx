import React, { useState } from "react";
import styles from "./dropdown-v2.module.css";

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
  carat?: string;
}

const pseudoDefaults: PseudoOptions = {
  color: "white",
  carat: "down",
};

/** A menu with a down carat that opens a modal below */
export function PseudoDropdown(options: React.PropsWithChildren<PseudoOptions>) {
  const opts = { ...pseudoDefaults, ...options };
  const [display, setDisplay] = useState(false);

  return (
    <div className={styles.main}>
      <div className={`${styles.label} ${styles[opts.color]}`} onClick={() => setDisplay(!display)}>
        {opts.children}&nbsp;
        <div className={styles[opts.carat]}>v</div>
      </div>
      <div className={styles.modal} style={{ display: display ? "block" : "none" }}>
        <opts.modal closeClick={() => setDisplay(!display)} />
      </div>
    </div>
  );
}
