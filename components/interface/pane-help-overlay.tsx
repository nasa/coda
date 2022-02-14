import styles from "./pane-help-overlay.module.css";

export default function HelpModal(props: { children; isModalOpen: boolean }) {
  const visibleClass = props.isModalOpen ? styles.helpModalWrapperVisible : "";
  return (
    <div className={`${styles.helpModalWrapper} ${visibleClass}`}>
      <div className={styles.helpBody}>{props.children}</div>
    </div>
  );
}
