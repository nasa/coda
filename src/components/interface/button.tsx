import { FunctionComponent, ReactNode } from "react";
import styles from "./button.module.css";

// Mapping objects for static class resolution
const colorClasses = {
  active: styles.active,
  selected: styles.selected,
  disabled: styles.disabled,
  active_selected: styles.active_selected,
  disabled_selected: styles.disabled_selected,
  active_other: styles.active_other,
} as const;

const sizeClasses = {
  default: styles.default,
  small: styles.small,
  medium: styles.medium,
} as const;

const roundedClasses = {
  all: styles.all,
  left: styles.left,
  right: styles.right,
  top: styles.top,
  bottom: styles.bottom,
  none: styles.none,
} as const;

// Extract types from the mapping objects
export type ColorVariant = keyof typeof colorClasses;
export type SizeVariant = keyof typeof sizeClasses;
export type RoundedVariant = keyof typeof roundedClasses;

const Button: FunctionComponent<{
  children: ReactNode;
  color: ColorVariant;
  size: SizeVariant;
  rounded?: RoundedVariant;
  callback?: () => void;
}> = ({ children, color, size = "default", rounded = "all", callback = () => {} }) => {
  const colorClass = colorClasses[color];
  const sizeClass = sizeClasses[size];
  const roundedClass = roundedClasses[rounded];

  return (
    <button
      onClick={callback}
      className={`${styles.button} ${colorClass} ${sizeClass} ${roundedClass}`}
    >
      {children}
    </button>
  );
};

export default Button;
