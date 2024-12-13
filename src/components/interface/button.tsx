import { FunctionComponent, ReactNode } from "react";
import styles from "./button.module.css";

const Button: FunctionComponent<{
  children: ReactNode;
  color: string;
  size: string;
  rounded?: string;
  callback?: () => void;
}> = ({ children, color = "grey", size = "default", rounded = "all", callback = () => {} }) => {
  return (
    <button
      onClick={callback}
      className={`${styles.button} ${styles[color]} ${styles[size]} ${styles[rounded]}`}
    >
      {children}
    </button>
  );
};

export default Button;
