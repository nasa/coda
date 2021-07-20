import React from "react";
import styles from "./button.module.css";

export interface Options {
  style?: string;
}

const defaults: Options = {
  style: "grey",
};

export default function Button(options: React.PropsWithChildren<Options>) {
  const opts = { ...defaults, ...options };

  return <button className={`${styles.button} ${styles[opts.style]}`}>{opts.children}</button>;
}
