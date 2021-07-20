import React from "react";
import styles from "./button.module.css";

export interface Options {
  style?: string;
  callback: () => void;
}

const defaults: Options = {
  style: "grey",
  callback: () => {},
};

/** Render a styled button to perform an action on a page. It SHOULD NOT be used to change pages. That's what <a /> is for */
export default function Button(options: React.PropsWithChildren<Options>) {
  const opts = { ...defaults, ...options };

  return (
    <button onClick={opts.callback} className={`${styles.button} ${styles[opts.style]}`}>
      {opts.children}
    </button>
  );
}
