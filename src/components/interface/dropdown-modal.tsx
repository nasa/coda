import {
  FunctionComponent,
  useRef,
  MouseEvent,
  ReactNode,
  useState,
  useEffect,
  ReactElement,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
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
  const [modalPos, setModalPos] = useState({ top: 0, left: 0 });

  const modalRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (labelRef.current) {
      const rect = labelRef.current.getBoundingClientRect();
      setModalPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setIsOpen((prev) => !prev);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: Event) => {
      const target = e.target as Node;
      if (labelRef.current?.contains(target)) return;
      if (modalRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const caretKey = isOpen ? oppositeCarets[opts.caret] : opts.caret;
  const caretStyle = caretClasses[caretKey];
  const colorClass = colorClasses[opts.color];
  const sizeClass = sizeClasses[opts.size];

  return (
    <>
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
      {isOpen &&
        opts.modal &&
        createPortal(
          <div
            ref={modalRef}
            className={styles.modal}
            style={{
              top: modalPos.top,
              left: modalPos.left,
              width: opts.modalWidth || undefined,
            }}
          >
            <opts.modal
              closeClick={() => setIsOpen(false)}
              options={opts.modalOptions as T}
              display={isOpen}
            />
          </div>,
          document.body
        )}
    </>
  );
};
