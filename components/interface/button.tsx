import React from "react";
import styles from "./button.module.css";

export interface Options {
  /** `grey`, `lightest-grey` */
  color?: string;
  /** `default`, `small` */
  size?: string;
  /** `all`, `left`, `right`, `none` */
  rounded?: string;
  callback?: () => void;
}

const defaults: Options = {
  color: "grey",
  size: "default",
  rounded: "all",
  callback: () => {},
};

/** Render a styled button to perform an action on a page. It SHOULD NOT be used to change pages. That's what <a /> is for */
export default function Button(options: React.PropsWithChildren<Options>) {
  const opts = { ...defaults, ...options };

  return (
    <button
      onClick={opts.callback}
      className={`${styles.button} ${styles[opts.color]} ${styles[opts.size]} ${
        styles[opts.rounded]
      }`}
    >
      {opts.children}
    </button>
  );
}
