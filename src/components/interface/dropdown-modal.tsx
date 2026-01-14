import {
  FunctionComponent,
  useRef,
  MouseEvent,
  ReactNode,
  useState,
  useEffect,
  ReactElement,
} from "react";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./dropdown-modal.module.css";

// Mapping objects for static class resolution
const colorClasses = {
  white: styles.white,
  grey: styles.grey,
} as const;

const sizeClasses = {
  default: styles.default,
  skinny: styles.skinny,
  medium: styles.medium,
} as const;

const caretClasses = {
  up: styles.up,
  down: styles.down,
  left: styles.left,
  right: styles.right,
} as const;

export type DropdownColorVariant = keyof typeof colorClasses;
export type DropdownSizeVariant = keyof typeof sizeClasses;
export type CaretVariant = keyof typeof caretClasses;

const oppositeCarets: Record<CaretVariant, CaretVariant> = {
  down: "up",
  up: "down",
  left: "right",
  right: "left",
};

const modalDefaults = {
  color: "white" as DropdownColorVariant,
  size: "default" as DropdownSizeVariant,
  caret: "down" as CaretVariant,
  modalOptions: {},
};

/** A menu with a down caret that opens a modal below */
export const ModalDropdown = <T extends Record<string, unknown> = Record<string, unknown>>({
  children,
  ...options
}: {
  children: ReactNode;
  color?: DropdownColorVariant;
  size?: DropdownSizeVariant;
  modalWidth?: number;
  caret?: CaretVariant;
  callback?: () => void;
  modal?: FunctionComponent<{
    closeClick?: () => void;
    options?: T;
    display?: boolean;
  }>;
  modalOptions?: T;
}): ReactElement => {
  const opts = { ...modalDefaults, ...options };
  const [isOpen, setIsOpen] = useState(false);
  const [modalTop, setModalTop] = useState<number | null>(null);

  const modalRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLButtonElement>(null);

  // Update modal position when dropdown opens
  useEffect(() => {
    if (isOpen && labelRef.current) {
      setModalTop(labelRef.current.getBoundingClientRect().bottom + 4);
    }
  }, [isOpen]);

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Only close if focus moves outside the entire dropdown container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  const caretKey = isOpen ? oppositeCarets[opts.caret] : opts.caret;
  const caretStyle = caretClasses[caretKey];
  const colorClass = colorClasses[opts.color];
  const sizeClass = sizeClasses[opts.size];
  const modalStyle: React.CSSProperties = {
    display: isOpen ? "block" : "none",
    width: opts.modalWidth ? opts.modalWidth + "px" : undefined,
    top: isOpen && modalTop ? `${modalTop}px` : undefined,
  };

  return (
    <div tabIndex={-1} onBlur={handleBlur}>
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
        {opts.modal && (
          <opts.modal
            closeClick={() => setIsOpen(false)}
            options={opts.modalOptions as T}
            display={isOpen}
          />
        )}
      </div>
    </div>
  );
};
